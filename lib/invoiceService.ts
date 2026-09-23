import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  runTransaction,
  getCountFromServer,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  DEFAULT_SHOP_SETTINGS,
  type Invoice,
  type ShopSettings,
} from "./invoiceTypes";
import {
  allocateFifo,
  normaliseLots,
  totalStock,
  type StockLot,
} from "./stockLots";

const SETTINGS_COLLECTION = "settings";
const SETTINGS_DOC_ID = "shopSettings";
const INVOICES_COLLECTION = "invoices";
const COUNTER_COLLECTION = "counters";
const INVOICE_COUNTER_ID = "invoices";

/**
 * Retrieves the shop configuration from Firestore, falling back to safe defaults.
 */
export async function getShopSettings(): Promise<ShopSettings> {
  try {
    const snap = await getDoc(doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID));
    if (snap.exists()) {
      return {
        ...DEFAULT_SHOP_SETTINGS,
        ...(snap.data() as Partial<ShopSettings>),
      };
    }
  } catch (err) {
    console.warn("Could not fetch shop settings, using defaults:", err);
  }
  return DEFAULT_SHOP_SETTINGS;
}

/**
 * Saves or updates the shop configuration in Firestore.
 */
export async function saveShopSettings(settings: Partial<ShopSettings>): Promise<void> {
  await setDoc(doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID), settings, { merge: true });
}

/**
 * Computes Indian financial year code (e.g. "25-26" for FY 2025-2026).
 */
export function getIndianFinancialYear(date: Date = new Date()): string {
  const month = date.getMonth(); // 0 = Jan, 2 = Mar, 3 = Apr
  const year = date.getFullYear();
  // Indian FY starts on April 1
  const startYear = month >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  return `${startYear.toString().slice(-2)}-${endYear.toString().slice(-2)}`;
}

/**
 * Safely generates the next sequential invoice number using the atomic counter.
 */
export async function peekNextInvoiceNumber(prefix: string = "GM"): Promise<string> {
  try {
    const counterSnap = await getDoc(doc(db, COUNTER_COLLECTION, INVOICE_COUNTER_ID));
    let nextNum = 1;
    if (counterSnap.exists()) {
      nextNum = (Number(counterSnap.data().lastInvoiceNumber) || 0) + 1;
    } else {
      const countSnap = await getCountFromServer(collection(db, INVOICES_COLLECTION));
      nextNum = countSnap.data().count + 1;
    }
    const fy = getIndianFinancialYear();
    return `${prefix}/${fy}/${String(nextNum).padStart(4, "0")}`;
  } catch {
    const fy = getIndianFinancialYear();
    return `${prefix}/${fy}/0001`;
  }
}

/**
 * Creates or updates an invoice in Firestore.
 * Automatically claims and increments the atomic invoice number if creating a new invoice without one.
 */
export async function saveInvoice(
  invoiceData: Omit<Invoice, "id">,
  existingId?: string
): Promise<string> {
  const targetId = existingId || doc(collection(db, INVOICES_COLLECTION)).id;

  await runTransaction(db, async (transaction) => {
    let invoiceNumber = invoiceData.invoiceNumber;

    if (!existingId) {
      // If creating new invoice, atomically allocate sequential invoice number if not already assigned
      const counterRef = doc(db, COUNTER_COLLECTION, INVOICE_COUNTER_ID);
      const counterSnap = await transaction.get(counterRef);

      const lastNum = counterSnap.exists()
        ? Number(counterSnap.data().lastInvoiceNumber) || 0
        : 0;
      const nextNum = lastNum + 1;

      // Update counter
      transaction.set(counterRef, { lastInvoiceNumber: nextNum }, { merge: true });

      if (!invoiceNumber || invoiceNumber.trim() === "") {
        const fy = getIndianFinancialYear(new Date(invoiceData.invoiceDate || new Date()));
        invoiceNumber = `GM/${fy}/${String(nextNum).padStart(4, "0")}`;
      }
    }

    const invoiceRef = doc(db, INVOICES_COLLECTION, targetId);
    const nowIso = new Date().toISOString();

    const dataToSave = {
      ...invoiceData,
      invoiceNumber,
      updatedAt: nowIso,
      ...(!existingId ? { createdAt: nowIso } : {}),
    };

    transaction.set(invoiceRef, dataToSave, { merge: true });
  });

  return targetId;
}

/**
 * Retrieves a single invoice by its Firestore document ID.
 */
export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const snap = await getDoc(doc(db, INVOICES_COLLECTION, id));
  if (!snap.exists()) return null;
  return {
    id: snap.id,
    ...(snap.data() as Omit<Invoice, "id">),
  };
}

/**
 * Retrieves all invoices ordered by invoiceDate / createdAt descending.
 */
export async function getInvoices(): Promise<Invoice[]> {
  try {
    const q = query(collection(db, INVOICES_COLLECTION), orderBy("invoiceDate", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Invoice, "id">),
    }));
  } catch (err) {
    console.warn("Index-based query failed, falling back to unsorted fetch:", err);
    const snap = await getDocs(collection(db, INVOICES_COLLECTION));
    return snap.docs
      .map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Invoice, "id">),
      }))
      .sort((a, b) => (b.invoiceDate || "").localeCompare(a.invoiceDate || ""));
  }
}

/**
 * Deletes an invoice document.
 */
export async function deleteInvoice(id: string): Promise<void> {
  await deleteDoc(doc(db, INVOICES_COLLECTION, id));
}

/**
 * Confirms an invoice and deducts inventory stock using FIFO lot allocation.
 * Guarantees atomic stock integrity and prevents duplicate deductions.
 */
export async function confirmInvoiceAndDeductStock(
  invoiceId: string
): Promise<{ success: boolean; message: string }> {
  return await runTransaction(db, async (transaction) => {
    const invoiceRef = doc(db, INVOICES_COLLECTION, invoiceId);
    const invoiceSnap = await transaction.get(invoiceRef);

    if (!invoiceSnap.exists()) {
      throw new Error("Invoice not found.");
    }

    const invoice = invoiceSnap.data() as Invoice;

    if (invoice.stockUpdated) {
      throw new Error("Inventory stock has already been deducted for this invoice.");
    }

    // Filter items linked to inventory products
    const inventoryItems = (invoice.items || []).filter(
      (item) => item.productId && item.productId.trim() !== ""
    );

    if (inventoryItems.length > 0) {
      const uniqueProductIds = Array.from(new Set(inventoryItems.map((i) => i.productId!)));

      // 1. READ PHASE: Read all relevant product documents
      const productSnaps: Record<string, Awaited<ReturnType<typeof transaction.get>>> = {};
      for (const pid of uniqueProductIds) {
        const snap = await transaction.get(doc(db, "products", pid));
        if (!snap.exists()) {
          const item = inventoryItems.find((i) => i.productId === pid);
          throw new Error(`Product "${item?.productName ?? pid}" no longer exists in inventory.`);
        }
        productSnaps[pid] = snap;
      }

      // 2. BUILD WORKING LOTS
      const lotsMap: Record<string, StockLot[]> = {};
      for (const pid of uniqueProductIds) {
        lotsMap[pid] = normaliseLots({
          id: pid,
          ...(productSnaps[pid].data() as {
            stock?: number;
            purchasePrice?: number;
            stockLots?: StockLot[];
          }),
        });
      }

      // 3. VALIDATE TOTAL QUANTITIES AGAINST AVAILABLE LOTS
      const reqQty: Record<string, number> = {};
      for (const item of inventoryItems) {
        reqQty[item.productId!] = (reqQty[item.productId!] || 0) + Number(item.quantity);
      }

      for (const [pid, qty] of Object.entries(reqQty)) {
        const available = totalStock(lotsMap[pid]);
        if (qty > available) {
          const name =
            (productSnaps[pid].data() as { name?: string }).name ??
            inventoryItems.find((i) => i.productId === pid)?.productName ??
            pid;
          throw new Error(
            `Insufficient stock for "${name}". Available: ${available}, requested: ${qty}.`
          );
        }
      }

      // 4. ALLOCATE FIFO AND WRITE PRODUCT UPDATES
      for (const item of inventoryItems) {
        const pid = item.productId!;
        const { updatedLots } = allocateFifo(lotsMap[pid], Number(item.quantity), item.productName);
        lotsMap[pid] = updatedLots;
      }

      // Write each updated product document
      for (const pid of uniqueProductIds) {
        const newLots = lotsMap[pid];
        const newStock = totalStock(newLots);
        transaction.update(doc(db, "products", pid), {
          stock: newStock,
          quantity: newStock,
          stockLots: newLots,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Mark invoice confirmed and stockUpdated = true
    transaction.update(invoiceRef, {
      status: "Confirmed",
      stockUpdated: true,
      updatedAt: new Date().toISOString(),
    });

    return {
      success: true,
      message: "Invoice confirmed and inventory stock updated successfully.",
    };
  });
}
