"use client";

import { useEffect, useRef, useState, Suspense, useMemo } from "react";
import {
  collection,
  getDocs,
  getCountFromServer,
  runTransaction,
  serverTimestamp,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addLot,
  generateLotId,
  normaliseLots,
  totalStock,
  type StockLot,
} from "@/lib/stockLots";
import { getTodayDateString, formatDisplayDate } from "@/lib/dateUtils";
import { getParties } from "@/lib/ledgerService";
import { type Party } from "@/lib/ledgerTypes";
import Link from "next/link";
import { useToast } from "@/components/ui/ToastContext";
import { sanitizeFirestoreData, assertNoUndefined } from "@/lib/firestoreUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Product = {
  id: string;
  name: string;
  unit: string;
  purchasePrice: number;
  sellingPrice?: number;
  size?: string;
  category?: string;
  stock?: number;
  estimatedStock?: number;
  piecesPerBox?: number;
  marbleType?: string;
  marbleCutSize?: string;
  marblePieces?: number | string;
  lotNumber?: string;
  granitePieces?: number | string;
  graniteLotNumber?: string;
  model?: string;
  material?: string;
  warranty?: string;
  weightVolume?: string;
  packType?: string;
  stockLots?: StockLot[];
};

type PurchaseItemForm = {
  id: string; // client temporary key
  purchaseType: "Existing Product" | "New Product";

  // Existing Product Fields
  productId: string;
  selectedProduct: Product | null;
  existingQty: string;
  existingPurchasePrice: string;
  existingSellingPrice: string;
  existingEstimatedStock: string;
  existingPieces: string;
  existingLotNumber: string;

  // New Product Master Fields
  newProductName: string;
  newCategory: string;
  newUnit: string;
  newTileSize: string;
  newPiecesPerBox: string;
  newGstRate: string;
  newMinimumStock: string;
  newMarbleType: "Slabs" | "Cut Size";
  newCutSize: string;
  newPieces: string;
  newLotNumber: string;
  newEstimatedStock: string;
  newModel: string;
  newMaterial: string;
  newWarranty: string;
  newWeightVolume: string;
  newPackType: string;

  // New Product Purchase Info
  newPurchaseQty: string;
  newPurchasePrice: string;
  newSellingPrice: string;
};

function createEmptyItem(defaultProduct?: Product | null): PurchaseItemForm {
  return {
    id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    purchaseType: "Existing Product",
    productId: defaultProduct?.id || "",
    selectedProduct: defaultProduct || null,
    existingQty: "",
    existingPurchasePrice: defaultProduct?.purchasePrice ? String(defaultProduct.purchasePrice) : "",
    existingSellingPrice: defaultProduct?.sellingPrice ? String(defaultProduct.sellingPrice) : "",
    existingEstimatedStock: defaultProduct?.estimatedStock ? String(defaultProduct.estimatedStock) : "",
    existingPieces: "",
    existingLotNumber: "",

    newProductName: "",
    newCategory: "Marble",
    newUnit: "sqft",
    newTileSize: "",
    newPiecesPerBox: "",
    newGstRate: "18",
    newMinimumStock: "0",
    newMarbleType: "Slabs",
    newCutSize: "",
    newPieces: "",
    newLotNumber: "",
    newEstimatedStock: "",
    newModel: "",
    newMaterial: "",
    newWarranty: "",
    newWeightVolume: "",
    newPackType: "",

    newPurchaseQty: "",
    newPurchasePrice: "",
    newSellingPrice: "",
  };
}

function getItemCalculations(it: PurchaseItemForm) {
  const isNew = it.purchaseType === "New Product";
  const qty = isNew ? Number(it.newPurchaseQty) || 0 : Number(it.existingQty) || 0;
  const price = isNew ? Number(it.newPurchasePrice) || 0 : Number(it.existingPurchasePrice) || 0;
  const total = qty * price;
  const name = isNew
    ? it.newProductName.trim() || "Untitled Product"
    : it.selectedProduct?.name || "Unselected Product";
  const category = isNew ? it.newCategory : it.selectedProduct?.category || "—";
  const unit = isNew ? it.newUnit : it.selectedProduct?.unit || "unit";
  const sellingPrice = isNew
    ? Number(it.newSellingPrice) || 0
    : it.existingSellingPrice !== ""
    ? Number(it.existingSellingPrice) || 0
    : it.selectedProduct?.sellingPrice || 0;

  return { isNew, qty, price, total, name, category, unit, sellingPrice };
}

// ─── Searchable Product Autocomplete ──────────────────────────────────────────

function ProductAutocomplete({
  products,
  value,
  onChange,
}: {
  products: Product[];
  value: string;
  onChange: (product: Product | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedProduct = products.find((p) => p.id === value) || null;

  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setQuery(
      selectedProduct
        ? `${selectedProduct.name} (${selectedProduct.category}${
            selectedProduct.size ? ` - ${selectedProduct.size}` : ""
          })`
        : ""
    );
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = products.filter((p) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = p.name.toLowerCase().includes(q);
    const catMatch = (p.category || "").toLowerCase().includes(q);
    const sizeMatch = (p.size || "").toLowerCase().includes(q);
    const typeMatch = (p.marbleType || "").toLowerCase().includes(q);
    return nameMatch || catMatch || sizeMatch || typeMatch;
  });

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          placeholder="Type product name, category, or size to search..."
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value) {
              onChange(null);
            }
          }}
          className="w-full pl-3 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-black focus:outline-none"
        />
        {selectedProduct ? (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQuery("");
              setOpen(false);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs px-1.5 py-0.5 rounded"
            title="Clear selection"
          >
            ✕
          </button>
        ) : (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">
            ▼
          </span>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-3 text-xs text-muted text-center">
              No matching products found in catalog.
            </div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p);
                  setQuery(
                    `${p.name} (${p.category}${p.size ? ` - ${p.size}` : ""})`
                  );
                  setOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2.5 text-xs hover:bg-gray-50 flex items-center justify-between border-b border-gray-100 last:border-b-0 ${
                  p.id === value ? "bg-blue-50/60 font-semibold" : ""
                }`}
              >
                <div>
                  <span className="font-bold text-gray-900">{p.name}</span>
                  <span className="text-gray-500 ml-2">
                    [{p.category}
                    {p.marbleType ? ` · ${p.marbleType}` : ""}
                    {p.size ? ` · ${p.size}` : ""}]
                  </span>
                </div>
                <div className="text-right text-[11px] text-gray-500 shrink-0 ml-2">
                  <span>Stock: {Number(p.stock || 0).toLocaleString("en-IN")} {p.unit}</span>
                  {p.sellingPrice ? (
                    <span className="ml-2 font-medium text-gray-800">
                      ₹{Number(p.sellingPrice).toLocaleString("en-IN")}
                    </span>
                  ) : null}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Export with Suspense wrapper ─────────────────────────────────────────────

export default function AddPurchasePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="w-8 h-8 border-3 border-gray-300 border-t-black rounded-full animate-spin" />
        </div>
      }
    >
      <AddPurchaseContent />
    </Suspense>
  );
}

function AddPurchaseContent() {
  const router = useRouter();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const preselectedProductId = searchParams.get("productId") || "";

  const [products, setProducts] = useState<Product[]>([]);
  const [parties, setParties] = useState<Party[]>([]);

  // ── Invoice Level State ─────────────────────────────────────────────────────
  const [supplierName, setSupplierName] = useState("");
  const [supplierInvoice, setSupplierInvoice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => getTodayDateString());
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [cashAmount, setCashAmount] = useState("");
  const [upiAmount, setUpiAmount] = useState("");
  const [bankAmount, setBankAmount] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [notes, setNotes] = useState("");

  // ── Multiple Purchase Items State ───────────────────────────────────────────
  const [items, setItems] = useState<PurchaseItemForm[]>([createEmptyItem()]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Load catalog products and suppliers list
  useEffect(() => {
    Promise.all([
      getDocs(collection(db, "products")),
      getParties().catch(() => [] as Party[]),
    ]).then(([snap, partyList]) => {
      const prodList = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Product, "id">),
      }));
      setProducts(prodList);
      setParties(partyList);

      if (preselectedProductId) {
        const found = prodList.find((p) => p.id === preselectedProductId);
        if (found) {
          setItems([createEmptyItem(found)]);
        }
      }
    });
  }, [preselectedProductId]);

  // Derived calculations for all items
  const itemsSummary = useMemo(() => {
    return items.map(getItemCalculations);
  }, [items]);

  const totalInvoiceItems = items.length;
  const totalInvoiceQuantity = useMemo(() => {
    return itemsSummary.reduce((sum, it) => sum + it.qty, 0);
  }, [itemsSummary]);
  const totalInvoiceAmount = useMemo(() => {
    return itemsSummary.reduce((sum, it) => sum + it.total, 0);
  }, [itemsSummary]);

  // Keep single payment method in sync with total
  useEffect(() => {
    if (paymentMethod === "Cash") {
      setCashAmount(String(totalInvoiceAmount));
      setUpiAmount("");
      setBankAmount("");
      setCreditAmount("");
    } else if (paymentMethod === "UPI") {
      setCashAmount("");
      setUpiAmount(String(totalInvoiceAmount));
      setBankAmount("");
      setCreditAmount("");
    } else if (paymentMethod === "Bank") {
      setCashAmount("");
      setUpiAmount("");
      setBankAmount(String(totalInvoiceAmount));
      setCreditAmount("");
    } else if (paymentMethod === "Credit / Due") {
      setCashAmount("");
      setUpiAmount("");
      setBankAmount("");
      setCreditAmount(String(totalInvoiceAmount));
    }
  }, [totalInvoiceAmount, paymentMethod]);

  const handlePaymentMethodChange = (newMethod: string) => {
    setPaymentMethod(newMethod);
    if (newMethod === "Cash") {
      setCashAmount(String(totalInvoiceAmount));
      setUpiAmount("");
      setBankAmount("");
      setCreditAmount("");
    } else if (newMethod === "UPI") {
      setCashAmount("");
      setUpiAmount(String(totalInvoiceAmount));
      setBankAmount("");
      setCreditAmount("");
    } else if (newMethod === "Bank") {
      setCashAmount("");
      setUpiAmount("");
      setBankAmount(String(totalInvoiceAmount));
      setCreditAmount("");
    } else if (newMethod === "Credit / Due") {
      setCashAmount("");
      setUpiAmount("");
      setBankAmount("");
      setCreditAmount(String(totalInvoiceAmount));
    } else if (newMethod === "Split") {
      setCashAmount("");
      setUpiAmount("");
      setBankAmount("");
      setCreditAmount("");
    }
  };

  const autoBalanceSplit = () => {
    const paid =
      (Number(cashAmount) || 0) +
      (Number(upiAmount) || 0) +
      (Number(bankAmount) || 0);
    const rem = Math.max(0, totalInvoiceAmount - paid);
    setCreditAmount(String(rem));
  };

  // ── Items Management Handlers ───────────────────────────────────────────────

  const handleAddItem = () => {
    setItems((prev) => [...prev, createEmptyItem()]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      showToast("An invoice must contain at least one product item.", "error");
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateItem = (index: number, updates: Partial<PurchaseItemForm>) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleItemCategoryChange = (index: number, cat: string) => {
    let unit = "piece";
    if (cat === "Tiles") unit = "box";
    else if (cat === "Marble") unit = "sqft";
    else if (cat === "Granite") unit = "sqft";

    updateItem(index, {
      newCategory: cat,
      newUnit: unit,
    });
  };

  const handleSelectProductForItem = (index: number, p: Product | null) => {
    if (p) {
      updateItem(index, {
        productId: p.id,
        selectedProduct: p,
        existingPurchasePrice: p.purchasePrice ? String(p.purchasePrice) : "",
        existingSellingPrice: p.sellingPrice ? String(p.sellingPrice) : "",
        existingEstimatedStock: p.estimatedStock ? String(p.estimatedStock) : "",
        existingQty: "",
        existingPieces: "",
        existingLotNumber: "",
      });
    } else {
      updateItem(index, {
        productId: "",
        selectedProduct: null,
        existingPurchasePrice: "",
        existingSellingPrice: "",
        existingEstimatedStock: "",
        existingQty: "",
        existingPieces: "",
        existingLotNumber: "",
      });
    }
  };

  // ── Form Submission (Atomic Save) ───────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!supplierName.trim()) {
      showToast("Please enter a supplier name.", "error");
      return;
    }
    if (!supplierInvoice.trim()) {
      showToast("Please enter the invoice number.", "error");
      return;
    }
    if (!purchaseDate.trim()) {
      showToast("Please select the purchase date.", "error");
      return;
    }
    if (items.length === 0) {
      showToast("Please add at least one product item.", "error");
      return;
    }

    // Validate each item
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const itemNum = i + 1;

      if (it.purchaseType === "Existing Product") {
        if (!it.productId || !it.selectedProduct) {
          showToast(`Please select an existing product for Item #${itemNum}.`, "error");
          return;
        }
        const qty = Number(it.existingQty);
        if (!it.existingQty || isNaN(qty) || qty <= 0) {
          showToast(
            `Please enter a valid quantity greater than 0 for Item #${itemNum} (${it.selectedProduct.name}).`,
            "error"
          );
          return;
        }
        const price = Number(it.existingPurchasePrice);
        if (it.existingPurchasePrice === "" || isNaN(price) || price < 0) {
          showToast(
            `Please enter a valid purchase price for Item #${itemNum} (${it.selectedProduct.name}).`,
            "error"
          );
          return;
        }
      } else {
        // New Product
        if (!it.newProductName.trim()) {
          showToast(`Please enter a product name for Item #${itemNum}.`, "error");
          return;
        }

        // Duplicate check in catalog
        const existingInCatalog = products.find(
          (p) =>
            p.name.trim().toLowerCase() === it.newProductName.trim().toLowerCase() &&
            p.category?.trim().toLowerCase() === it.newCategory.trim().toLowerCase()
        );
        if (existingInCatalog) {
          showToast(
            `"${it.newProductName.trim()}" in Item #${itemNum} already exists in your ${it.newCategory} catalog. Please select "Existing Product" instead.`,
            "error"
          );
          return;
        }

        // Duplicate check with previous new items in this same invoice
        for (let j = 0; j < i; j++) {
          const prev = items[j];
          if (
            prev.purchaseType === "New Product" &&
            prev.newProductName.trim().toLowerCase() === it.newProductName.trim().toLowerCase() &&
            prev.newCategory.trim().toLowerCase() === it.newCategory.trim().toLowerCase()
          ) {
            showToast(
              `Item #${itemNum} has the same name and category as Item #${j + 1} in this invoice.`,
              "error"
            );
            return;
          }
        }

        const qty = Number(it.newPurchaseQty);
        if (!it.newPurchaseQty || isNaN(qty) || qty <= 0) {
          showToast(
            `Please enter a valid purchase quantity greater than 0 for Item #${itemNum} (${it.newProductName}).`,
            "error"
          );
          return;
        }
        const pPrice = Number(it.newPurchasePrice);
        if (it.newPurchasePrice === "" || isNaN(pPrice) || pPrice < 0) {
          showToast(
            `Please enter a valid purchase price for Item #${itemNum} (${it.newProductName}).`,
            "error"
          );
          return;
        }
        const sPrice = Number(it.newSellingPrice);
        if (it.newSellingPrice === "" || isNaN(sPrice) || sPrice < 0) {
          showToast(
            `Please enter a valid selling price for Item #${itemNum} (${it.newProductName}).`,
            "error"
          );
          return;
        }
      }
    }

    // Split payment sum check
    if (paymentMethod === "Split") {
      const paidSum =
        (Number(cashAmount) || 0) +
        (Number(upiAmount) || 0) +
        (Number(bankAmount) || 0) +
        (Number(creditAmount) || 0);
      if (Math.abs(paidSum - totalInvoiceAmount) > 0.01) {
        showToast(
          `Split payment sum (₹${paidSum.toLocaleString("en-IN")}) does not equal total invoice amount (₹${totalInvoiceAmount.toLocaleString("en-IN")}).`,
          "error"
        );
        return;
      }
    }

    try {
      setSaving(true);

      // 1. Get next purchase number
      const snapCount = await getCountFromServer(collection(db, "purchases"));
      const purchaseNumber = snapCount.data().count + 1;

      // 2. Pre-allocate references for New Products & generate unique lot IDs
      const newProductRefs: Record<string, ReturnType<typeof doc>> = {};
      const lotIds: Record<string, string> = {};

      items.forEach((it) => {
        lotIds[it.id] = generateLotId();
        if (it.purchaseType === "New Product") {
          newProductRefs[it.id] = doc(collection(db, "products"));
        }
      });

      const newPurchaseRef = doc(collection(db, "purchases"));

      // 3. Execute atomic transaction
      await runTransaction(db, async (transaction) => {
        // Step A: Read all existing products inside transaction
        const existingProductIds = Array.from(
          new Set(
            items
              .filter((it) => it.purchaseType === "Existing Product")
              .map((it) => it.productId)
          )
        );

        const existingSnaps: Record<string, Awaited<ReturnType<typeof transaction.get>>> = {};
        for (const pid of existingProductIds) {
          const snap = await transaction.get(doc(db, "products", pid));
          if (!snap.exists()) {
            throw new Error(`Product (ID: ${pid}) was not found in the database.`);
          }
          existingSnaps[pid] = snap;
        }

        // Step B: Maintain in-memory lotsMap per product so multiple lines of the same product merge cleanly
        const lotsMap: Record<string, StockLot[]> = {};
        const latestPriceMap: Record<
          string,
          { purchasePrice: number; sellingPrice?: number; estimatedStock?: number }
        > = {};

        for (const pid of existingProductIds) {
          const snapData = existingSnaps[pid].data() as {
            stock?: number;
            purchasePrice?: number;
            stockLots?: StockLot[];
            sellingPrice?: number;
            estimatedStock?: number;
          };
          lotsMap[pid] = normaliseLots({
            id: pid,
            stock: snapData.stock,
            purchasePrice: snapData.purchasePrice,
            stockLots: snapData.stockLots,
          });
        }

        // Step C: Process each item
        const finalPurchaseItems: any[] = [];

        for (const it of items) {
          if (it.purchaseType === "New Product") {
            const newDocRef = newProductRefs[it.id];
            const newPid = newDocRef.id;
            const qty = Number(it.newPurchaseQty);
            const pPrice = Number(it.newPurchasePrice);
            const sPrice = Number(it.newSellingPrice);
            const itemTotal = qty * pPrice;
            const lotId = lotIds[it.id];
            const estStock = it.newEstimatedStock ? Number(it.newEstimatedStock) : qty;

            const initialLot: StockLot = {
              lotId,
              purchasePrice: pPrice,
              quantity: qty,
              originalQuantity: qty,
              purchasedAt: purchaseDate,
              supplierName: supplierName.trim(),
              invoiceNumber: supplierInvoice.trim(),
            };
            const trimmedNewLotNumber = it.newLotNumber.trim();
            if (
              trimmedNewLotNumber &&
              !(it.newCategory === "Marble" && it.newMarbleType === "Cut Size")
            ) {
              initialLot.lotNumber = trimmedNewLotNumber;
            }

            const newProductDoc: Record<string, any> = {
              name: it.newProductName.trim(),
              category: it.newCategory.trim(),
              unit: it.newUnit.trim(),
              purchasePrice: pPrice,
              sellingPrice: sPrice,
              stock: qty, // EXACT INITIAL PURCHASE QUANTITY, NEVER 0!
              estimatedStock: estStock,
              stockLots: [initialLot],
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };

            if (it.newCategory === "Tiles") {
              if (it.newTileSize.trim()) newProductDoc.size = it.newTileSize.trim();
              if (it.newPiecesPerBox) newProductDoc.piecesPerBox = Number(it.newPiecesPerBox);
            } else if (it.newCategory === "Marble") {
              newProductDoc.marbleType = it.newMarbleType;
              if (it.newMarbleType === "Cut Size") {
                if (it.newCutSize.trim()) newProductDoc.size = it.newCutSize.trim();
                if (it.newPieces) newProductDoc.pieces = Number(it.newPieces);
                // Cut Size: DO NOT save lotNumber
              } else {
                // Slabs
                if (it.newPieces) newProductDoc.pieces = Number(it.newPieces);
                if (it.newLotNumber.trim()) newProductDoc.lotNumber = it.newLotNumber.trim();
              }
            } else if (it.newCategory === "Granite") {
              if (it.newPieces) newProductDoc.pieces = Number(it.newPieces);
              if (it.newLotNumber.trim()) newProductDoc.lotNumber = it.newLotNumber.trim();
            } else if (["Sanitary", "Taps", "Wash Basin", "Sink"].includes(it.newCategory)) {
              if (it.newModel.trim()) newProductDoc.model = it.newModel.trim();
              if (it.newMaterial.trim()) newProductDoc.material = it.newMaterial.trim();
              if (it.newWarranty.trim()) newProductDoc.warranty = it.newWarranty.trim();
            } else if (["Chemicals", "Adhesives"].includes(it.newCategory)) {
              if (it.newWeightVolume.trim()) newProductDoc.weightVolume = it.newWeightVolume.trim();
              if (it.newPackType.trim()) newProductDoc.packType = it.newPackType.trim();
            }

            if (it.newGstRate) newProductDoc.gstRate = Number(it.newGstRate);
            if (it.newMinimumStock) newProductDoc.minimumStock = Number(it.newMinimumStock);

            const cleanNewProductDoc = sanitizeFirestoreData(newProductDoc);
            if (process.env.NODE_ENV !== "production") {
              assertNoUndefined(cleanNewProductDoc, `New Product document (${newPid})`);
            }
            transaction.set(newDocRef, cleanNewProductDoc);

            const purchaseItem: Record<string, any> = {
              productId: newPid,
              productName: it.newProductName.trim(),
              category: it.newCategory.trim(),
              quantity: qty,
              unit: it.newUnit.trim(),
              purchasePrice: pPrice,
              sellingPrice: sPrice,
              total: itemTotal,
              lotId,
              lotNumber:
                it.newCategory === "Marble" && it.newMarbleType === "Cut Size"
                  ? ""
                  : it.newLotNumber.trim() || "",
              size:
                it.newCategory === "Marble" && it.newMarbleType === "Cut Size"
                  ? it.newCutSize.trim()
                  : it.newTileSize.trim() || "",
              purchasedAt: purchaseDate,
            };

            if (it.newPieces && it.newPieces.trim() !== "" && !isNaN(Number(it.newPieces))) {
              purchaseItem.pieces = Number(it.newPieces);
            }

            finalPurchaseItems.push(purchaseItem);
          } else {
            // Existing Product
            const pid = it.productId;
            const prod = it.selectedProduct!;
            const qty = Number(it.existingQty);
            const pPrice = Number(it.existingPurchasePrice);
            const sPrice =
              it.existingSellingPrice.trim() !== ""
                ? Number(it.existingSellingPrice)
                : prod.sellingPrice !== undefined && prod.sellingPrice !== null
                ? Number(prod.sellingPrice)
                : undefined;
            const itemTotal = qty * pPrice;
            const lotId = lotIds[it.id];

            const extraLotInfo: { supplierName?: string; invoiceNumber?: string; lotNumber?: string } = {
              supplierName: supplierName.trim(),
              invoiceNumber: supplierInvoice.trim(),
            };
            const trimmedLotNum = it.existingLotNumber.trim() || (prod.lotNumber ? String(prod.lotNumber).trim() : "");
            if (
              trimmedLotNum &&
              !(prod.category === "Marble" && prod.marbleType === "Cut Size")
            ) {
              extraLotInfo.lotNumber = trimmedLotNum;
            }

            const addRes = addLot(lotsMap[pid], pPrice, qty, purchaseDate, extraLotInfo);
            lotsMap[pid] = addRes.lots;

            const estStockVal =
              it.existingEstimatedStock.trim() !== "" && !isNaN(Number(it.existingEstimatedStock))
                ? Number(it.existingEstimatedStock)
                : undefined;

            latestPriceMap[pid] = {
              purchasePrice: pPrice,
              ...(sPrice !== undefined && !isNaN(sPrice) ? { sellingPrice: sPrice } : {}),
              ...(estStockVal !== undefined ? { estimatedStock: estStockVal } : {}),
            };

            const purchaseItem: Record<string, any> = {
              productId: pid,
              productName: prod.name || "Product",
              category: prod.category || "General",
              quantity: qty,
              unit: prod.unit || "unit",
              purchasePrice: pPrice,
              total: itemTotal,
              lotId,
              lotNumber:
                prod.category === "Marble" && prod.marbleType === "Cut Size"
                  ? ""
                  : it.existingLotNumber.trim() || prod.lotNumber || "",
              size: prod.size || "",
              purchasedAt: purchaseDate,
            };

            // Only set sellingPrice if it is defined and a valid number
            if (sPrice !== undefined && sPrice !== null && !isNaN(sPrice)) {
              purchaseItem.sellingPrice = Number(sPrice);
            }

            // Only set pieces if entered and a valid number
            if (it.existingPieces && it.existingPieces.trim() !== "" && !isNaN(Number(it.existingPieces))) {
              purchaseItem.pieces = Number(it.existingPieces);
            }

            finalPurchaseItems.push(purchaseItem);
          }
        }

        // Step D: Write updates for all existing products
        for (const pid of existingProductIds) {
          const updatedLots = lotsMap[pid];
          const newStock = totalStock(updatedLots);
          const updates: Record<string, any> = {
            stockLots: updatedLots,
            stock: newStock,
            updatedAt: serverTimestamp(),
          };
          if (latestPriceMap[pid]?.purchasePrice !== undefined && !isNaN(latestPriceMap[pid].purchasePrice)) {
            updates.purchasePrice = latestPriceMap[pid].purchasePrice;
          }
          if (latestPriceMap[pid]?.sellingPrice !== undefined && latestPriceMap[pid].sellingPrice !== null && !isNaN(latestPriceMap[pid].sellingPrice)) {
            updates.sellingPrice = latestPriceMap[pid].sellingPrice;
          }
          if (latestPriceMap[pid]?.estimatedStock !== undefined && !isNaN(latestPriceMap[pid].estimatedStock)) {
            updates.estimatedStock = latestPriceMap[pid].estimatedStock;
          }

          const cleanUpdates = sanitizeFirestoreData(updates);
          if (process.env.NODE_ENV !== "production") {
            assertNoUndefined(cleanUpdates, `Product document updates (ID: ${pid})`);
          }
          transaction.update(doc(db, "products", pid), cleanUpdates);
        }

        // Step E: Create single purchase invoice document
        let paidAmt = 0;
        let dueAmt = 0;
        if (
          paymentMethod === "Cash" ||
          paymentMethod === "UPI" ||
          paymentMethod === "Bank"
        ) {
          paidAmt = totalInvoiceAmount;
          dueAmt = 0;
        } else if (paymentMethod === "Credit / Due") {
          paidAmt = 0;
          dueAmt = totalInvoiceAmount;
        } else if (paymentMethod === "Split") {
          paidAmt =
            (Number(cashAmount) || 0) +
            (Number(upiAmount) || 0) +
            (Number(bankAmount) || 0);
          dueAmt = Number(creditAmount) || 0;
        }

        const purchaseData: Record<string, any> = {
          purchaseNumber,
          purchaseDate,
          supplierName: supplierName.trim(),
          supplierInvoice: supplierInvoice.trim(),
          items: finalPurchaseItems,
          totalAmount: totalInvoiceAmount,
          paymentMethod,
          paidAmount: paidAmt,
          dueAmount: dueAmt,
          status: "Completed",
          notes: notes.trim(),
          createdAt: serverTimestamp(),
        };

        if (paymentMethod === "Split") {
          purchaseData.cashAmount = Number(cashAmount) || 0;
          purchaseData.upiAmount = Number(upiAmount) || 0;
          purchaseData.bankAmount = Number(bankAmount) || 0;
          purchaseData.creditAmount = Number(creditAmount) || 0;
        }

        const cleanPurchaseData = sanitizeFirestoreData(purchaseData);
        if (process.env.NODE_ENV !== "production") {
          assertNoUndefined(cleanPurchaseData, `Purchase invoice (ID: ${newPurchaseRef.id})`);
        }
        transaction.set(newPurchaseRef, cleanPurchaseData);
      });

      showToast("Purchase invoice recorded successfully.", "success");
      router.push("/dashboard/purchases");
    } catch (err: any) {
      console.error("Error saving purchase invoice:", err);
      const errMsg = err?.message || "Failed to save purchase invoice.";
      setError(errMsg);
      showToast(errMsg, "error");
    } finally {
      setSaving(false);
    }
  };

  const supplierParties = parties.filter(
    (p) => p.type === "Supplier" || p.type === "Both"
  );

  return (
    <main className="page-main">
      <header className="site-header">
        <h1 className="text-xl">Gaurav Marbles</h1>
        <p className="text-muted">Record Supplier Purchase Invoice</p>
      </header>

      <div className="page-content-narrow space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Add Purchase Invoice</h2>
            <p className="text-muted text-xs mt-0.5">
              Enter invoice details once, then add one or multiple products to this invoice.
            </p>
          </div>
          <Link href="/dashboard/purchases" className="btn-secondary text-sm">
            ← Back to Purchases
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── SECTION 1: PURCHASE INVOICE HEADER ───────────────────────────────── */}
          <div className="card p-6 border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-5">
              <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                <span>🧾</span> Purchase Invoice Details
              </h3>
              <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200">
                Single Supplier &amp; Invoice
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {/* Supplier Name */}
              <div className="form-field">
                <label className="font-semibold text-gray-800">
                  Supplier Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  list="suppliersList"
                  placeholder="e.g. ABC Marble, Rajasthan Mines"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="font-medium"
                />
                <datalist id="suppliersList">
                  {supplierParties.map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
                </datalist>
                <span className="text-[11px] text-muted">
                  Type or pick from registered suppliers.
                </span>
              </div>

              {/* Invoice Number */}
              <div className="form-field">
                <label className="font-semibold text-gray-800">
                  Invoice Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. INV-105, BILL-882"
                  value={supplierInvoice}
                  onChange={(e) => setSupplierInvoice(e.target.value)}
                  className="font-semibold font-mono"
                />
                <span className="text-[11px] text-muted">
                  Supplier bill/challan number.
                </span>
              </div>

              {/* Invoice Date */}
              <div className="form-field">
                <label className="font-semibold text-gray-800">
                  Invoice Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="font-semibold"
                />
                <span className="text-[11px] text-muted">
                  Displays as {formatDisplayDate(purchaseDate)}
                </span>
              </div>
            </div>

            {/* Payment Method Section */}
            <div className="mt-5 pt-5 border-t border-gray-100">
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">
                Invoice Payment Method
              </label>
              <div className="flex flex-wrap gap-2">
                {(["Cash", "UPI", "Bank", "Credit / Due", "Split"] as const).map((method) => {
                  const active = paymentMethod === method;
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => handlePaymentMethodChange(method)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        active
                          ? "bg-gray-900 text-white border-gray-900 shadow-sm"
                          : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {method}
                    </button>
                  );
                })}
              </div>

              {/* Split Breakdown */}
              {paymentMethod === "Split" && (
                <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-800 uppercase">
                      Split Payment Breakdown
                    </span>
                    <button
                      type="button"
                      onClick={autoBalanceSplit}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      Auto-Balance Credit/Due →
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-gray-600">Cash (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={cashAmount}
                        onChange={(e) => setCashAmount(e.target.value)}
                        className="text-sm font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-600">UPI (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={upiAmount}
                        onChange={(e) => setUpiAmount(e.target.value)}
                        className="text-sm font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-600">Bank (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={bankAmount}
                        onChange={(e) => setBankAmount(e.target.value)}
                        className="text-sm font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-600">Credit / Due (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={creditAmount}
                        onChange={(e) => setCreditAmount(e.target.value)}
                        className="text-sm font-semibold text-amber-700"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── SECTION 2: PURCHASE ITEMS ───────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Purchase Items ({items.length})</h3>
                <p className="text-muted text-xs mt-0.5">
                  Configure each product in this invoice. Each item can be an Existing Product or a New Product.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="btn-secondary text-xs font-bold flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
              >
                <span>+</span> Add Another Purchase
              </button>
            </div>

            {items.map((it, index) => {
              const itemNum = index + 1;
              const isNew = it.purchaseType === "New Product";
              const itemCalc = itemsSummary[index] || getItemCalculations(it);

              // Duplicate warning check for this specific item if New Product
              const duplicateInCatalog =
                isNew && it.newProductName.trim()
                  ? products.find(
                      (p) =>
                        p.name.trim().toLowerCase() === it.newProductName.trim().toLowerCase() &&
                        p.category?.trim().toLowerCase() === it.newCategory.trim().toLowerCase()
                    )
                  : null;

              return (
                <div
                  key={it.id}
                  className="card p-6 border-2 border-gray-200 shadow-sm relative transition-all"
                >
                  {/* Item Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-200 mb-5 gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-gray-900 text-white font-bold text-xs flex items-center justify-center">
                        {itemNum}
                      </span>
                      <div>
                        <h4 className="font-bold text-base text-gray-900">
                          Product #{itemNum}:{" "}
                          <span className="text-blue-700 font-semibold">{itemCalc.name}</span>
                        </h4>
                        <span className="text-xs text-muted">
                          Item Total:{" "}
                          <strong className="text-gray-900 font-bold">
                            ₹{itemCalc.total.toLocaleString("en-IN")}
                          </strong>
                          {itemCalc.qty > 0 ? ` (${itemCalc.qty} ${itemCalc.unit} @ ₹${itemCalc.price})` : ""}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 justify-between sm:justify-end">
                      {/* Per-Item Type Selector */}
                      <div className="inline-flex rounded-lg p-0.5 sm:p-1 bg-gray-100 border border-gray-200">
                        <button
                          type="button"
                          onClick={() => updateItem(index, { purchaseType: "Existing Product" })}
                          className={`px-2.5 sm:px-3 py-1 text-xs font-bold rounded-md transition-all ${
                            !isNew
                              ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                              : "text-gray-600 hover:text-gray-900"
                          }`}
                        >
                          📦 Existing Product
                        </button>
                        <button
                          type="button"
                          onClick={() => updateItem(index, { purchaseType: "New Product" })}
                          className={`px-2.5 sm:px-3 py-1 text-xs font-bold rounded-md transition-all ${
                            isNew
                              ? "bg-purple-600 text-white shadow-sm"
                              : "text-gray-600 hover:text-gray-900"
                          }`}
                        >
                          ✨ New Product
                        </button>
                      </div>

                      {/* Remove Button */}
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-xs font-semibold text-red-600 hover:text-red-800 px-2 py-1 hover:bg-red-50 rounded border border-transparent hover:border-red-200 shrink-0"
                          title="Remove this item from invoice"
                        >
                          ✕ Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ── CASE A: EXISTING PRODUCT ITEM ── */}
                  {!isNew ? (
                    <div className="space-y-4">
                      {/* Product Selector */}
                      <div className="form-field mb-0">
                        <label className="font-semibold text-gray-800 text-sm">
                          Select Product <span className="text-red-500">*</span>
                        </label>
                        <ProductAutocomplete
                          products={products}
                          value={it.productId}
                          onChange={(p) => handleSelectProductForItem(index, p)}
                        />
                      </div>

                      {/* Read-Only Product Specs Card */}
                      {it.selectedProduct ? (
                        <div className="p-3.5 bg-blue-50/50 border border-blue-200 rounded-lg text-xs space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-bold text-gray-900 text-sm">
                              {it.selectedProduct.name}
                            </span>
                            <span className="font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
                              {it.selectedProduct.category}
                              {it.selectedProduct.marbleType ? ` · ${it.selectedProduct.marbleType}` : ""}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-gray-600 pt-1 border-t border-blue-100">
                            <div>
                              <span className="text-gray-400 block text-[10px] uppercase">Unit</span>
                              <strong className="text-gray-800 font-semibold">{it.selectedProduct.unit}</strong>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[10px] uppercase">Current Stock</span>
                              <strong className="text-gray-800 font-semibold">
                                {Number(it.selectedProduct.stock || 0).toLocaleString("en-IN")} {it.selectedProduct.unit}
                              </strong>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[10px] uppercase">Active Selling Rate</span>
                              <strong className="text-emerald-700 font-semibold">
                                {it.selectedProduct.sellingPrice ? `₹${it.selectedProduct.sellingPrice}` : "Not set"}
                              </strong>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[10px] uppercase">Last Cost</span>
                              <strong className="text-gray-800 font-semibold">
                                {it.selectedProduct.purchasePrice ? `₹${it.selectedProduct.purchasePrice}` : "—"}
                              </strong>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center text-xs text-muted">
                          Search and select an existing product from your catalog above.
                        </div>
                      )}

                      {/* Existing Product Purchase Inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                        <div className="form-field">
                          <label className="font-semibold text-gray-800">
                            Quantity ({it.selectedProduct?.unit || "unit"}) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            required
                            placeholder="e.g. 250"
                            value={it.existingQty}
                            onChange={(e) => updateItem(index, { existingQty: e.target.value })}
                            className="font-bold text-base"
                          />
                        </div>

                        <div className="form-field">
                          <label className="font-semibold text-gray-800">
                            Purchase Price (₹) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            required
                            placeholder="Cost rate for this lot"
                            value={it.existingPurchasePrice}
                            onChange={(e) => updateItem(index, { existingPurchasePrice: e.target.value })}
                            className="font-bold text-base"
                          />
                        </div>

                        <div className="form-field">
                          <label className="font-semibold text-gray-800">
                            Selling Price (₹) <span className="text-xs text-muted">(Updates catalog)</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="Active selling rate"
                            value={it.existingSellingPrice}
                            onChange={(e) => updateItem(index, { existingSellingPrice: e.target.value })}
                            className="font-semibold text-emerald-700"
                          />
                        </div>
                      </div>

                      {/* Optional Category specifics for Existing Product */}
                      {it.selectedProduct?.category === "Marble" &&
                        it.selectedProduct?.marbleType === "Slabs" && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                            <div className="form-field mb-0">
                              <label>Pieces (Optional)</label>
                              <input
                                type="number"
                                min="1"
                                placeholder="Count of slabs"
                                value={it.existingPieces}
                                onChange={(e) => updateItem(index, { existingPieces: e.target.value })}
                              />
                            </div>
                            <div className="form-field mb-0">
                              <label>Lot Number (Optional)</label>
                              <input
                                type="text"
                                placeholder="e.g. LOT-A"
                                value={it.existingLotNumber}
                                onChange={(e) => updateItem(index, { existingLotNumber: e.target.value })}
                              />
                            </div>
                            <div className="form-field mb-0">
                              <label>Estimated Stock (sqft)</label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="e.g. 300"
                                value={it.existingEstimatedStock}
                                onChange={(e) => updateItem(index, { existingEstimatedStock: e.target.value })}
                              />
                            </div>
                          </div>
                        )}

                      {it.selectedProduct?.category === "Marble" &&
                        it.selectedProduct?.marbleType === "Cut Size" && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                            <div className="form-field mb-0">
                              <label>Pieces (Optional)</label>
                              <input
                                type="number"
                                min="1"
                                placeholder="e.g. 50"
                                value={it.existingPieces}
                                onChange={(e) => updateItem(index, { existingPieces: e.target.value })}
                              />
                            </div>
                            <div className="flex items-center text-muted text-xs italic">
                              ℹ Cut Size has fixed dimensions. Lot Number is not applicable.
                            </div>
                          </div>
                        )}
                    </div>
                  ) : (
                    /* ── CASE B: NEW PRODUCT MASTER ITEM ── */
                    <div className="space-y-4">
                      {/* Duplicate Alert Banner */}
                      {duplicateInCatalog && (
                        <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-center justify-between text-xs text-amber-900">
                          <div>
                            <strong>⚠️ Product already exists:</strong> &quot;{duplicateInCatalog.name}&quot; is already in your {duplicateInCatalog.category} catalog.
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectProductForItem(index, duplicateInCatalog);
                              updateItem(index, { purchaseType: "Existing Product" });
                            }}
                            className="ml-3 font-bold text-blue-700 underline hover:text-blue-900 shrink-0"
                          >
                            Select Existing Product →
                          </button>
                        </div>
                      )}

                      {/* Product Master Attributes */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="form-field">
                          <label className="font-semibold text-gray-800">
                            Product Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. South Black, White Statuario"
                            value={it.newProductName}
                            onChange={(e) => updateItem(index, { newProductName: e.target.value })}
                            className="font-bold"
                          />
                        </div>

                        <div className="form-field">
                          <label className="font-semibold text-gray-800">
                            Category <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={it.newCategory}
                            onChange={(e) => handleItemCategoryChange(index, e.target.value)}
                            className="font-medium"
                          >
                            <option value="Marble">Marble</option>
                            <option value="Tiles">Tiles</option>
                            <option value="Granite">Granite</option>
                            <option value="Sanitary">Sanitary</option>
                            <option value="Taps">Taps</option>
                            <option value="Wash Basin">Wash Basin</option>
                            <option value="Sink">Sink</option>
                            <option value="Chemicals">Chemicals</option>
                            <option value="Adhesives">Adhesives</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>

                        <div className="form-field">
                          <label className="font-semibold text-gray-800">
                            Unit <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="sqft, box, piece"
                            value={it.newUnit}
                            onChange={(e) => updateItem(index, { newUnit: e.target.value })}
                            className="font-medium"
                          />
                        </div>
                      </div>

                      {/* Marble Specifics: Slabs vs Cut Size */}
                      {it.newCategory === "Marble" && (
                        <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-700 uppercase">
                              Marble Type:
                            </span>
                            <div className="inline-flex rounded-lg p-0.5 bg-white border border-gray-300">
                              <button
                                type="button"
                                onClick={() => updateItem(index, { newMarbleType: "Slabs" })}
                                className={`px-2.5 py-1 text-xs font-bold rounded ${
                                  it.newMarbleType === "Slabs"
                                    ? "bg-gray-900 text-white"
                                    : "text-gray-700 hover:bg-gray-100"
                                }`}
                              >
                                Slabs
                              </button>
                              <button
                                type="button"
                                onClick={() => updateItem(index, { newMarbleType: "Cut Size" })}
                                className={`px-2.5 py-1 text-xs font-bold rounded ${
                                  it.newMarbleType === "Cut Size"
                                    ? "bg-gray-900 text-white"
                                    : "text-gray-700 hover:bg-gray-100"
                                }`}
                              >
                                Cut Size
                              </button>
                            </div>
                          </div>

                          {it.newMarbleType === "Cut Size" ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              <div className="form-field mb-0">
                                <label className="font-semibold text-gray-700">
                                  Size (e.g. 2x4, 2x2, 3x6) <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. 2x4"
                                  value={it.newCutSize}
                                  onChange={(e) => updateItem(index, { newCutSize: e.target.value })}
                                />
                              </div>
                              <div className="form-field mb-0">
                                <label className="font-semibold text-gray-700">Pieces (Optional)</label>
                                <input
                                  type="number"
                                  min="1"
                                  placeholder="e.g. 50"
                                  value={it.newPieces}
                                  onChange={(e) => updateItem(index, { newPieces: e.target.value })}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                              <div className="form-field mb-0">
                                <label className="font-semibold text-gray-700">Pieces (Optional)</label>
                                <input
                                  type="number"
                                  min="1"
                                  placeholder="e.g. 24"
                                  value={it.newPieces}
                                  onChange={(e) => updateItem(index, { newPieces: e.target.value })}
                                />
                              </div>
                              <div className="form-field mb-0">
                                <label className="font-semibold text-gray-700">Lot Number (Optional)</label>
                                <input
                                  type="text"
                                  placeholder="e.g. LOT-A"
                                  value={it.newLotNumber}
                                  onChange={(e) => updateItem(index, { newLotNumber: e.target.value })}
                                />
                              </div>
                              <div className="form-field mb-0">
                                <label className="font-semibold text-gray-700">Estimated Stock (sqft)</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  placeholder="e.g. 300"
                                  value={it.newEstimatedStock}
                                  onChange={(e) => updateItem(index, { newEstimatedStock: e.target.value })}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tiles Specifics */}
                      {it.newCategory === "Tiles" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs">
                          <div className="form-field mb-0">
                            <label className="font-semibold text-gray-700">Tile Size (e.g. 2x4, 12x18)</label>
                            <input
                              type="text"
                              placeholder="e.g. 2x4"
                              value={it.newTileSize}
                              onChange={(e) => updateItem(index, { newTileSize: e.target.value })}
                            />
                          </div>
                          <div className="form-field mb-0">
                            <label className="font-semibold text-gray-700">Pieces Per Box</label>
                            <input
                              type="number"
                              min="1"
                              placeholder="e.g. 4"
                              value={it.newPiecesPerBox}
                              onChange={(e) => updateItem(index, { newPiecesPerBox: e.target.value })}
                            />
                          </div>
                        </div>
                      )}

                      {/* Granite Specifics */}
                      {it.newCategory === "Granite" && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs">
                          <div className="form-field mb-0">
                            <label className="font-semibold text-gray-700">Pieces (Optional)</label>
                            <input
                              type="number"
                              min="1"
                              placeholder="e.g. 10"
                              value={it.newPieces}
                              onChange={(e) => updateItem(index, { newPieces: e.target.value })}
                            />
                          </div>
                          <div className="form-field mb-0">
                            <label className="font-semibold text-gray-700">Lot Number (Optional)</label>
                            <input
                              type="text"
                              placeholder="e.g. GR-01"
                              value={it.newLotNumber}
                              onChange={(e) => updateItem(index, { newLotNumber: e.target.value })}
                            />
                          </div>
                          <div className="form-field mb-0">
                            <label className="font-semibold text-gray-700">Estimated Stock (sqft)</label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="e.g. 200"
                              value={it.newEstimatedStock}
                              onChange={(e) => updateItem(index, { newEstimatedStock: e.target.value })}
                            />
                          </div>
                        </div>
                      )}

                      {/* Sanitary / Hardware Specifics */}
                      {["Sanitary", "Taps", "Wash Basin", "Sink"].includes(it.newCategory) && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs">
                          <div className="form-field mb-0">
                            <label>Model / Code</label>
                            <input
                              type="text"
                              placeholder="e.g. Kohler K-123"
                              value={it.newModel}
                              onChange={(e) => updateItem(index, { newModel: e.target.value })}
                            />
                          </div>
                          <div className="form-field mb-0">
                            <label>Material</label>
                            <input
                              type="text"
                              placeholder="e.g. Ceramic, Brass"
                              value={it.newMaterial}
                              onChange={(e) => updateItem(index, { newMaterial: e.target.value })}
                            />
                          </div>
                          <div className="form-field mb-0">
                            <label>Warranty</label>
                            <input
                              type="text"
                              placeholder="e.g. 5 Years"
                              value={it.newWarranty}
                              onChange={(e) => updateItem(index, { newWarranty: e.target.value })}
                            />
                          </div>
                        </div>
                      )}

                      {/* New Product Purchase Numbers */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                        <div className="form-field">
                          <label className="font-semibold text-gray-800">
                            Purchase Quantity ({it.newUnit}) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            required
                            placeholder="e.g. 250"
                            value={it.newPurchaseQty}
                            onChange={(e) => updateItem(index, { newPurchaseQty: e.target.value })}
                            className="font-bold text-base"
                          />
                        </div>

                        <div className="form-field">
                          <label className="font-semibold text-gray-800">
                            Purchase Price (₹) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            required
                            placeholder="Cost rate per unit"
                            value={it.newPurchasePrice}
                            onChange={(e) => updateItem(index, { newPurchasePrice: e.target.value })}
                            className="font-bold text-base"
                          />
                        </div>

                        <div className="form-field">
                          <label className="font-semibold text-gray-800">
                            Selling Price (₹) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            required
                            placeholder="Catalog selling rate"
                            value={it.newSellingPrice}
                            onChange={(e) => updateItem(index, { newSellingPrice: e.target.value })}
                            className="font-bold text-base text-emerald-700"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* "+ Add Another Purchase" Button */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={handleAddItem}
                className="btn-secondary text-sm font-bold px-6 py-2.5 bg-blue-50 text-blue-700 border-2 border-dashed border-blue-300 hover:bg-blue-100 hover:border-blue-400 rounded-lg inline-flex items-center gap-2"
              >
                <span className="text-lg leading-none">+</span> Add Another Purchase
              </button>
            </div>
          </div>

          {/* ── SECTION 3: INVOICE SUMMARY & SAVE ────────────────────────────────── */}
          <div className="card p-6 bg-gradient-to-r from-gray-900 to-gray-800 text-white shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-700 mb-4 gap-4">
              <div>
                <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">
                  Invoice Summary
                </span>
                <h3 className="text-2xl font-bold mt-1">
                  ₹{totalInvoiceAmount.toLocaleString("en-IN")}
                </h3>
                <p className="text-xs text-gray-300 mt-0.5">
                  Total Items: <strong className="text-white">{totalInvoiceItems}</strong> · Total Quantity:{" "}
                  <strong className="text-white">{totalInvoiceQuantity.toLocaleString("en-IN")}</strong>
                </p>
              </div>

              <div className="text-right sm:text-right">
                <span className="text-xs text-gray-400 block">Payment Method</span>
                <span className="text-sm font-bold text-emerald-400 uppercase tracking-wide">
                  {paymentMethod}
                </span>
              </div>
            </div>

            {/* Items summary list */}
            <div className="space-y-1.5 mb-5 max-h-48 overflow-y-auto pr-1">
              {itemsSummary.map((it, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1 border-b border-gray-700/60 last:border-b-0"
                >
                  <span className="truncate pr-2">
                    <span className="text-gray-400 mr-1.5">#{idx + 1}</span>
                    <strong className="text-white">{it.name}</strong>{" "}
                    <span className="text-gray-400">({it.qty} {it.unit} @ ₹{it.price})</span>
                  </span>
                  <span className="font-bold text-emerald-300 shrink-0">
                    ₹{it.total.toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>

            {/* Optional Notes */}
            <div className="mb-5">
              <label className="text-xs text-gray-300 font-semibold block mb-1">
                Internal Purchase Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Paid advance via NEFT, driver contact, delivery remarks"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs text-gray-900 bg-white rounded p-2"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-900/80 border border-red-500 rounded text-xs text-white mb-4">
                {error}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2.5 sm:gap-3 pt-2">
              <Link
                href="/dashboard/purchases"
                className="btn-secondary text-xs text-center py-2.5 px-4 bg-gray-700 text-white border-gray-600 hover:bg-gray-600 w-full sm:w-auto"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary text-sm font-bold py-2.5 px-8 bg-emerald-500 hover:bg-emerald-600 text-white border-none shadow-md disabled:opacity-50 w-full sm:w-auto text-center justify-center"
              >
                {saving ? "Saving Invoice..." : "Save Purchase Invoice"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
