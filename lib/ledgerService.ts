import {
  collection,
  doc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  type Party,
  type LedgerEntry,
  type LedgerItem,
  type LedgerReportData,
  type LedgerPage,
  formatTallyDate,
} from "./ledgerTypes";
import { getShopSettings } from "./invoiceService";

const PARTIES_COLLECTION = "parties";
const VOUCHERS_COLLECTION = "vouchers";
const CUSTOMERS_COLLECTION = "customers";
const SALES_COLLECTION = "sales";
const INVOICES_COLLECTION = "invoices";
const PURCHASES_COLLECTION = "purchases";
const PAYMENTS_COLLECTION = "payments";

/**
 * Retrieves all parties by merging Firestore `parties`, `customers`,
 * and historical suppliers from `purchases`.
 */
export async function getParties(): Promise<Party[]> {
  try {
    const [partySnap, custSnap, purchSnap] = await Promise.all([
      getDocs(collection(db, PARTIES_COLLECTION)),
      getDocs(collection(db, CUSTOMERS_COLLECTION)),
      getDocs(collection(db, PURCHASES_COLLECTION)),
    ]);

    const partiesMap = new Map<string, Party>();

    // 1. Explicit parties in `parties` collection
    partySnap.docs.forEach((d) => {
      const data = d.data();
      partiesMap.set(d.id, {
        id: d.id,
        name: data.name || "Unnamed Party",
        type: data.type || "Customer",
        address: data.address || "",
        city: data.city || "Firozabad",
        state: data.state || "Uttar Pradesh",
        stateCode: data.stateCode || "09",
        gstin: data.gstin || "",
        phone: data.phone || "",
        openingBalance: Number(data.openingBalance) || 0,
        openingBalanceType: data.openingBalanceType || "Debit",
        creditLimit: data.creditLimit ? Number(data.creditLimit) : undefined,
        paymentTerms: data.paymentTerms || "",
        status: data.status || "Active",
        notes: data.notes || "",
        createdAt: data.createdAt,
      });
    });

    // 2. Existing customers from `customers` collection (if not already in parties)
    custSnap.docs.forEach((d) => {
      const data = d.data();
      const existing = Array.from(partiesMap.values()).find(
        (p) => p.id === d.id || p.name.toLowerCase() === (data.name || "").toLowerCase()
      );
      if (!existing) {
        partiesMap.set(d.id, {
          id: d.id,
          name: data.name || "Customer",
          type: "Customer",
          address: data.address || "",
          city: "Firozabad",
          state: "Uttar Pradesh",
          stateCode: "09",
          phone: data.phone || "",
          openingBalance: 0,
          openingBalanceType: "Debit",
          status: "Active",
          createdAt: data.createdAt,
        });
      }
    });

    // 3. Historical suppliers from `purchases` collection
    purchSnap.docs.forEach((d) => {
      const data = d.data();
      const sName = (data.supplierName || "").trim();
      if (sName) {
        const existing = Array.from(partiesMap.values()).find(
          (p) => p.name.toLowerCase() === sName.toLowerCase()
        );
        if (!existing) {
          const pseudoId = `sup_${sName.toLowerCase().replace(/\s+/g, "_")}`;
          partiesMap.set(pseudoId, {
            id: pseudoId,
            name: sName,
            type: "Supplier",
            address: "",
            city: "Firozabad",
            state: "Uttar Pradesh",
            stateCode: "09",
            openingBalance: 0,
            openingBalanceType: "Credit",
            status: "Active",
          });
        }
      }
    });

    return Array.from(partiesMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  } catch (err) {
    console.error("Error loading parties:", err);
    return [];
  }
}

/**
 * Saves or updates a party record in Firestore `parties`.
 */
export async function saveParty(party: Partial<Party>): Promise<string> {
  const partyId = party.id || doc(collection(db, PARTIES_COLLECTION)).id;
  const now = new Date().toISOString();

  const partyData: Party = {
    id: partyId,
    name: (party.name || "").trim(),
    type: party.type || "Customer",
    address: party.address || "",
    city: party.city || "Firozabad",
    state: party.state || "Uttar Pradesh",
    stateCode: party.stateCode || "09",
    gstin: party.gstin || "",
    phone: party.phone || "",
    openingBalance: Number(party.openingBalance) || 0,
    openingBalanceType: party.openingBalanceType || "Debit",
    creditLimit: party.creditLimit ? Number(party.creditLimit) : undefined,
    paymentTerms: party.paymentTerms || "",
    status: party.status || "Active",
    notes: party.notes || "",
    createdAt: party.createdAt || now,
    updatedAt: now,
  };

  await setDoc(doc(db, PARTIES_COLLECTION, partyId), partyData, { merge: true });
  return partyId;
}

/**
 * Deletes a party if no transactions exist.
 */
export async function deleteParty(id: string, partyName: string): Promise<void> {
  // Check sales
  const salesSnap = await getDocs(collection(db, SALES_COLLECTION));
  const hasSale = salesSnap.docs.some(
    (d) => d.data().customerId === id || d.data().customerName === partyName
  );
  if (hasSale) {
    throw new Error(`Cannot delete "${partyName}": Sales transactions are linked to this party.`);
  }

  // Check purchases
  const purchSnap = await getDocs(collection(db, PURCHASES_COLLECTION));
  const hasPurch = purchSnap.docs.some(
    (d) => (d.data().supplierName || "").toLowerCase() === partyName.toLowerCase()
  );
  if (hasPurch) {
    throw new Error(`Cannot delete "${partyName}": Purchase transactions are linked to this party.`);
  }

  await deleteDoc(doc(db, PARTIES_COLLECTION, id));
}

/**
 * Records a generic accounting voucher (Receipt, Payment, Journal).
 * Also synchronizes to `payments` collection for consistency.
 */
export async function recordVoucher(voucher: {
  date: string;
  voucherType: "Receipt" | "Payment" | "Journal";
  partyId: string;
  partyName: string;
  partyType: "Customer" | "Supplier";
  amount: number;
  paymentMode: string;
  account: string; // e.g. "Axis Bank" or "Cash"
  referenceNumber?: string;
  narration?: string;
  againstInvoiceNo?: string;
}): Promise<string> {
  const vchRef = doc(collection(db, VOUCHERS_COLLECTION));
  const now = new Date().toISOString();

  const voucherNumber =
    voucher.referenceNumber && voucher.referenceNumber.trim() !== ""
      ? voucher.referenceNumber.trim()
      : String(Math.floor(1000 + Math.random() * 9000));

  await setDoc(vchRef, {
    ...voucher,
    voucherNumber,
    createdAt: now,
  });

  // Sync with `payments` collection
  if (voucher.voucherType === "Receipt" || voucher.voucherType === "Payment") {
    await addDoc(collection(db, PAYMENTS_COLLECTION), {
      customerId: voucher.partyId,
      customerName: voucher.partyName,
      amount: voucher.amount,
      date: voucher.date,
      paymentMethod: voucher.account || voucher.paymentMode,
      referenceNumber: voucherNumber,
      notes: voucher.narration || "",
      voucherId: vchRef.id,
      createdAt: now,
    });
  }

  return vchRef.id;
}

/**
 * Compiles a Tally-style Customer Ledger matching `G F.pdf` format.
 */
export async function compileCustomerLedger(params: {
  partyId: string;
  fromDate: string;
  toDate: string;
}): Promise<LedgerReportData> {
  const { partyId, fromDate, toDate } = params;

  const [parties, shopSettings, salesSnap, invoicesSnap, paymentsSnap, vouchersSnap] =
    await Promise.all([
      getParties(),
      getShopSettings(),
      getDocs(collection(db, SALES_COLLECTION)),
      getDocs(collection(db, INVOICES_COLLECTION)),
      getDocs(collection(db, PAYMENTS_COLLECTION)),
      getDocs(collection(db, VOUCHERS_COLLECTION)),
    ]);

  const party = parties.find((p) => p.id === partyId) || {
    id: partyId,
    name: "Customer",
    type: "Customer" as const,
    city: "Agra",
    state: "Uttar Pradesh",
    stateCode: "09",
    openingBalance: 0,
    openingBalanceType: "Debit" as const,
    status: "Active" as const,
  };

  const pName = party.name.toLowerCase().trim();

  // 1. Gather all sales & invoices
  type RawTx = {
    id: string;
    date: string;
    particulars: string;
    voucherType: "Sales" | "Receipt" | "Payment" | "Journal";
    voucherNumber: string;
    debit: number;
    credit: number;
    narration?: string;
    items?: LedgerItem[];
  };

  const rawTransactions: RawTx[] = [];
  const processedInvoiceNumbers = new Set<string>();

  // A. Invoices from `invoices` collection
  invoicesSnap.docs.forEach((d) => {
    const inv = d.data();
    const cName = (inv.consignee?.name || inv.buyer?.name || "").toLowerCase().trim();
    if (cName === pName || (party.id && inv.consignee?.id === party.id)) {
      const invNum = inv.invoiceNumber || d.id;
      processedInvoiceNumbers.add(invNum.toLowerCase());

      const items: LedgerItem[] = (inv.items || []).map((i: {
        productName?: string;
        quantity?: number;
        unit?: string;
        rate?: number;
        amount?: number;
      }) => ({
        productName: i.productName || "Goods",
        quantity: Number(i.quantity) || 0,
        unit: i.unit || "boxs",
        rate: Number(i.rate) || 0,
        amount: Number(i.amount) || 0,
      }));

      rawTransactions.push({
        id: `inv_${d.id}`,
        date: inv.invoiceDate || "",
        particulars: "To Bill Invoice 18%",
        voucherType: "Sales",
        voucherNumber: invNum,
        debit: Number(inv.grandTotal) || Number(inv.subtotal) || 0,
        credit: 0,
        items,
      });
    }
  });

  // B. Sales from `sales` collection (avoid duplicates with invoices)
  salesSnap.docs.forEach((d) => {
    const sale = d.data();
    const sCustName = (sale.customerName || "").toLowerCase().trim();
    if (sale.customerId === party.id || sCustName === pName) {
      const sNum = String(sale.saleNumber || d.id);
      if (!processedInvoiceNumbers.has(sNum.toLowerCase())) {
        const items: LedgerItem[] = (sale.items || []).map((i: {
          productName?: string;
          quantity?: number;
          unit?: string;
          sellingPrice?: number;
          total?: number;
        }) => ({
          productName: i.productName || "Goods",
          quantity: Number(i.quantity) || 0,
          unit: i.unit || "boxs",
          rate: Number(i.sellingPrice) || 0,
          amount: Number(i.total) || 0,
        }));

        rawTransactions.push({
          id: `sale_${d.id}`,
          date: sale.saleDate || "",
          particulars: "To Bill Invoice 18%",
          voucherType: "Sales",
          voucherNumber: sNum,
          debit: Number(sale.totalAmount) || 0,
          credit: 0,
          items,
        });
      }
    }
  });

  // C. Receipts / Payments from `payments` collection
  paymentsSnap.docs.forEach((d) => {
    const p = d.data();
    const pCust = (p.customerName || "").toLowerCase().trim();
    if (p.customerId === party.id || pCust === pName) {
      const method = p.paymentMethod || "Cash";
      const particulars = method.toLowerCase().includes("bank")
        ? `By ${method}`
        : method.toLowerCase().includes("axis")
        ? "By Axis Bank"
        : `By ${method}`;

      rawTransactions.push({
        id: `pay_${d.id}`,
        date: p.date || "",
        particulars,
        voucherType: "Receipt",
        voucherNumber: p.referenceNumber || String(p.receiptNumber || ""),
        debit: 0,
        credit: Number(p.amount) || 0,
        narration: p.notes || "",
      });
    }
  });

  // D. Vouchers from `vouchers` collection (manual journals or receipts not in payments)
  vouchersSnap.docs.forEach((d) => {
    const v = d.data();
    const vCust = (v.partyName || "").toLowerCase().trim();
    if (v.partyId === party.id || vCust === pName) {
      // Check if already represented in payments
      const exists = rawTransactions.some((r) => r.id === `pay_${v.paymentId}` || r.id === `vch_${d.id}`);
      if (!exists && v.voucherType === "Receipt") {
        rawTransactions.push({
          id: `vch_${d.id}`,
          date: v.date || "",
          particulars: v.account ? `By ${v.account}` : "By Cash",
          voucherType: "Receipt",
          voucherNumber: v.voucherNumber || "",
          debit: 0,
          credit: Number(v.amount) || 0,
          narration: v.narration || "",
        });
      } else if (!exists && v.voucherType === "Journal") {
        rawTransactions.push({
          id: `vch_${d.id}`,
          date: v.date || "",
          particulars: v.particulars || "By Journal",
          voucherType: "Journal",
          voucherNumber: v.voucherNumber || "",
          debit: Number(v.debit) || 0,
          credit: Number(v.credit) || 0,
          narration: v.narration || "",
        });
      }
    }
  });

  // 2. Separate into: Pre-Period (prior to fromDate) vs In-Period
  let netOpening =
    party.openingBalanceType === "Debit"
      ? Number(party.openingBalance) || 0
      : -(Number(party.openingBalance) || 0);

  const inPeriodTx: RawTx[] = [];

  rawTransactions.forEach((tx) => {
    const txDate = tx.date.trim().split("T")[0];
    if (fromDate && txDate < fromDate) {
      // Pre-period: adds to opening balance
      netOpening += tx.debit - tx.credit;
    } else if (!toDate || txDate <= toDate) {
      inPeriodTx.push(tx);
    }
  });

  // Sort in-period transactions chronologically
  inPeriodTx.sort((a, b) => a.date.localeCompare(b.date));

  // 3. Build formatted LedgerEntry array
  const entries: LedgerEntry[] = [];
  let runningBal = netOpening;

  // Initial Opening Balance Entry
  const openingAmount = Math.abs(netOpening);
  const openingType: "Debit" | "Credit" = netOpening >= 0 ? "Debit" : "Credit";

  if (openingAmount > 0) {
    entries.push({
      id: "opening-entry",
      date: fromDate || inPeriodTx[0]?.date || "2025-10-01",
      formattedDate: formatTallyDate(fromDate || inPeriodTx[0]?.date || "2025-10-01"),
      particulars: openingType === "Debit" ? "To Opening Balance" : "By Opening Balance",
      voucherType: "Opening Balance",
      voucherNumber: "",
      debit: openingType === "Debit" ? openingAmount : 0,
      credit: openingType === "Credit" ? openingAmount : 0,
      runningBalance: openingAmount,
      runningBalanceType: openingType === "Debit" ? "Dr" : "Cr",
      partyId: party.id,
      partyName: party.name,
    });
  }

  // Add In-Period entries
  inPeriodTx.forEach((tx) => {
    runningBal += tx.debit - tx.credit;
    const rbType = runningBal > 0 ? "Dr" : runningBal < 0 ? "Cr" : "Nil";

    entries.push({
      id: tx.id,
      date: tx.date,
      formattedDate: formatTallyDate(tx.date),
      particulars: tx.particulars,
      voucherType: tx.voucherType,
      voucherNumber: tx.voucherNumber,
      debit: tx.debit,
      credit: tx.credit,
      runningBalance: Math.abs(runningBal),
      runningBalanceType: rbType,
      narration: tx.narration,
      items: tx.items,
      partyId: party.id,
      partyName: party.name,
    });
  });

  // 4. Calculate Column Totals & Closing Balance
  let totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  let totalCredit = entries.reduce((s, e) => s + e.credit, 0);

  // Round to 2 decimals
  totalDebit = Math.round((totalDebit + Number.EPSILON) * 100) / 100;
  totalCredit = Math.round((totalCredit + Number.EPSILON) * 100) / 100;

  // Closing balance to equalize columns:
  // If Debit < Credit, we put difference in Debit: "To Closing Balance [diff]"
  // If Credit < Debit, we put difference in Credit: "By Closing Balance [diff]"
  const diff = Math.round(Math.abs(totalDebit - totalCredit) * 100) / 100;
  const grandTotal = Math.max(totalDebit, totalCredit);

  let closingParticulars = "To Closing Balance";
  let closingType: "Debit" | "Credit" = "Debit";

  if (totalDebit < totalCredit) {
    closingParticulars = "To Closing Balance";
    closingType = "Debit";
  } else {
    closingParticulars = "By Closing Balance";
    closingType = "Credit";
  }

  // 5. Build Multi-Page Pagination with Carried Over / Brought Forward
  const pages = paginateLedgerEntries(entries, 16);

  // Date range label
  const fromLabel = formatTallyDate(fromDate || "2025-10-01", true);
  const toLabel = formatTallyDate(toDate || new Date().toISOString().split("T")[0], true);

  return {
    party,
    shopName: shopSettings.shopName || "Gaurav Marbles",
    city: party.city || "Agra",
    dateRange: {
      from: fromDate,
      to: toDate,
      label: `${fromLabel} to ${toLabel}`,
    },
    openingBalance: {
      amount: openingAmount,
      type: openingType,
    },
    entries,
    totalDebit,
    totalCredit,
    closingBalance: {
      amount: diff,
      type: closingType,
      particulars: closingParticulars,
    },
    grandTotal,
    pages,
  };
}

/**
 * Compiles a Tally-style Supplier Ledger matching `G F.pdf` layout.
 */
export async function compileSupplierLedger(params: {
  partyIdOrName: string;
  fromDate: string;
  toDate: string;
}): Promise<LedgerReportData> {
  const { partyIdOrName, fromDate, toDate } = params;

  const [parties, shopSettings, purchSnap, paymentsSnap, vouchersSnap] =
    await Promise.all([
      getParties(),
      getShopSettings(),
      getDocs(collection(db, PURCHASES_COLLECTION)),
      getDocs(collection(db, PAYMENTS_COLLECTION)),
      getDocs(collection(db, VOUCHERS_COLLECTION)),
    ]);

  const party = parties.find(
    (p) =>
      p.id === partyIdOrName ||
      p.name.toLowerCase().trim() === partyIdOrName.toLowerCase().trim()
  ) || {
    id: partyIdOrName,
    name: partyIdOrName,
    type: "Supplier" as const,
    city: "Firozabad",
    state: "Uttar Pradesh",
    stateCode: "09",
    openingBalance: 0,
    openingBalanceType: "Credit" as const,
    status: "Active" as const,
  };

  const pName = party.name.toLowerCase().trim();

  type RawTx = {
    id: string;
    date: string;
    particulars: string;
    voucherType: "Purchase" | "Payment" | "Journal";
    voucherNumber: string;
    debit: number;
    credit: number;
    narration?: string;
    items?: LedgerItem[];
  };

  const rawTransactions: RawTx[] = [];

  // 1. Purchases (Credits in Supplier Ledger)
  purchSnap.docs.forEach((d) => {
    const purch = d.data();
    const sName = (purch.supplierName || "").toLowerCase().trim();
    if (sName === pName) {
      const items: LedgerItem[] = (purch.items || []).map((i: {
        productName?: string;
        quantity?: number;
        unit?: string;
        purchasePrice?: number;
        total?: number;
      }) => ({
        productName: i.productName || "Goods",
        quantity: Number(i.quantity) || 0,
        unit: i.unit || "boxs",
        rate: Number(i.purchasePrice) || 0,
        amount: Number(i.total) || 0,
      }));

      rawTransactions.push({
        id: `purch_${d.id}`,
        date: purch.purchaseDate || "",
        particulars: "By Purchase Invoice",
        voucherType: "Purchase",
        voucherNumber: String(purch.purchaseNumber || d.id),
        debit: 0,
        credit: Number(purch.totalAmount) || 0,
        items,
      });
    }
  });

  // 2. Payments (Debits in Supplier Ledger)
  paymentsSnap.docs.forEach((d) => {
    const p = d.data();
    const sName = (p.supplierName || p.customerName || "").toLowerCase().trim();
    if (sName === pName) {
      const method = p.paymentMethod || "Cash";
      const particulars = method.toLowerCase().includes("axis")
        ? "To Axis Bank"
        : method.toLowerCase().includes("bank")
        ? `To ${method}`
        : "To Cash";

      rawTransactions.push({
        id: `pay_${d.id}`,
        date: p.date || "",
        particulars,
        voucherType: "Payment",
        voucherNumber: p.referenceNumber || String(p.receiptNumber || ""),
        debit: Number(p.amount) || 0,
        credit: 0,
        narration: p.notes || "",
      });
    }
  });

  // 3. Vouchers
  vouchersSnap.docs.forEach((d) => {
    const v = d.data();
    const vName = (v.partyName || "").toLowerCase().trim();
    if (v.partyId === party.id || vName === pName) {
      if (v.voucherType === "Payment") {
        rawTransactions.push({
          id: `vch_${d.id}`,
          date: v.date || "",
          particulars: v.account ? `To ${v.account}` : "To Cash",
          voucherType: "Payment",
          voucherNumber: v.voucherNumber || "",
          debit: Number(v.amount) || 0,
          credit: 0,
          narration: v.narration || "",
        });
      }
    }
  });

  // Pre-Period Calculation:
  // For supplier, opening balance Credit is payable (positive), Debit is advance (negative)
  let netOpening =
    party.openingBalanceType === "Credit"
      ? Number(party.openingBalance) || 0
      : -(Number(party.openingBalance) || 0);

  const inPeriodTx: RawTx[] = [];

  rawTransactions.forEach((tx) => {
    const txDate = tx.date.trim().split("T")[0];
    if (fromDate && txDate < fromDate) {
      netOpening += tx.credit - tx.debit;
    } else if (!toDate || txDate <= toDate) {
      inPeriodTx.push(tx);
    }
  });

  inPeriodTx.sort((a, b) => a.date.localeCompare(b.date));

  const entries: LedgerEntry[] = [];
  let runningBal = netOpening;

  const openingAmount = Math.abs(netOpening);
  const openingType: "Debit" | "Credit" = netOpening >= 0 ? "Credit" : "Debit";

  if (openingAmount > 0) {
    entries.push({
      id: "opening-entry",
      date: fromDate || inPeriodTx[0]?.date || "2025-10-01",
      formattedDate: formatTallyDate(fromDate || inPeriodTx[0]?.date || "2025-10-01"),
      particulars: openingType === "Credit" ? "By Opening Balance" : "To Opening Balance",
      voucherType: "Opening Balance",
      voucherNumber: "",
      debit: openingType === "Debit" ? openingAmount : 0,
      credit: openingType === "Credit" ? openingAmount : 0,
      runningBalance: openingAmount,
      runningBalanceType: openingType === "Credit" ? "Cr" : "Dr",
      partyId: party.id,
      partyName: party.name,
    });
  }

  inPeriodTx.forEach((tx) => {
    runningBal += tx.credit - tx.debit;
    const rbType = runningBal > 0 ? "Cr" : runningBal < 0 ? "Dr" : "Nil";

    entries.push({
      id: tx.id,
      date: tx.date,
      formattedDate: formatTallyDate(tx.date),
      particulars: tx.particulars,
      voucherType: tx.voucherType,
      voucherNumber: tx.voucherNumber,
      debit: tx.debit,
      credit: tx.credit,
      runningBalance: Math.abs(runningBal),
      runningBalanceType: rbType,
      narration: tx.narration,
      items: tx.items,
      partyId: party.id,
      partyName: party.name,
    });
  });

  let totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  let totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  totalDebit = Math.round((totalDebit + Number.EPSILON) * 100) / 100;
  totalCredit = Math.round((totalCredit + Number.EPSILON) * 100) / 100;

  const diff = Math.round(Math.abs(totalDebit - totalCredit) * 100) / 100;
  const grandTotal = Math.max(totalDebit, totalCredit);

  let closingParticulars = "By Closing Balance";
  let closingType: "Debit" | "Credit" = "Credit";

  if (totalDebit < totalCredit) {
    closingParticulars = "To Closing Balance";
    closingType = "Debit";
  } else {
    closingParticulars = "By Closing Balance";
    closingType = "Credit";
  }

  const pages = paginateLedgerEntries(entries, 16);
  const fromLabel = formatTallyDate(fromDate || "2025-10-01", true);
  const toLabel = formatTallyDate(toDate || new Date().toISOString().split("T")[0], true);

  return {
    party,
    shopName: shopSettings.shopName || "Gaurav Marbles",
    city: party.city || "Firozabad",
    dateRange: {
      from: fromDate,
      to: toDate,
      label: `${fromLabel} to ${toLabel}`,
    },
    openingBalance: {
      amount: openingAmount,
      type: openingType,
    },
    entries,
    totalDebit,
    totalCredit,
    closingBalance: {
      amount: diff,
      type: closingType,
      particulars: closingParticulars,
    },
    grandTotal,
    pages,
  };
}

/**
 * Splits ledger entries across pages with cumulative Carried Over / Brought Forward.
 */
function paginateLedgerEntries(entries: LedgerEntry[], pageSize: number = 16): LedgerPage[] {
  if (entries.length === 0) {
    return [
      {
        pageNumber: 1,
        totalPages: 1,
        entries: [],
        isLastPage: true,
      },
    ];
  }

  const pages: LedgerPage[] = [];
  let currentDebitSum = 0;
  let currentCreditSum = 0;

  const totalPages = Math.ceil(entries.length / pageSize);

  for (let i = 0; i < totalPages; i++) {
    const pageEntries = entries.slice(i * pageSize, (i + 1) * pageSize);
    const broughtForward =
      i > 0
        ? {
            debit: currentDebitSum,
            credit: currentCreditSum,
          }
        : undefined;

    pageEntries.forEach((e) => {
      currentDebitSum += e.debit;
      currentCreditSum += e.credit;
    });

    const isLast = i === totalPages - 1;
    const carriedOver = !isLast
      ? {
          debit: Math.round((currentDebitSum + Number.EPSILON) * 100) / 100,
          credit: Math.round((currentCreditSum + Number.EPSILON) * 100) / 100,
        }
      : undefined;

    pages.push({
      pageNumber: i + 1,
      totalPages,
      entries: pageEntries,
      broughtForward,
      carriedOver,
      isLastPage: isLast,
    });
  }

  return pages;
}
