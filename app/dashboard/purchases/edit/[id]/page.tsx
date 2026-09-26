"use client";

import { useEffect, useRef, useState } from "react";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  runTransaction,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useParams, useRouter } from "next/navigation";
import {
  addLot,
  checkPurchaseCanBeReversed,
  normaliseLots,
  removeLotQuantity,
  totalStock,
  type StockLot,
} from "@/lib/stockLots";
import { sanitizeFirestoreData, assertNoUndefined } from "@/lib/firestoreUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Product = {
  id: string;
  name: string;
  unit: string;
  purchasePrice: number;
  size?: string;
  category?: string;
  stock?: number;
};

type LineItem = {
  productId: string;
  productName: string;
  quantity: string;
  unit: string;
  purchasePrice: string;
  total: number;
};

const emptyItem = (): LineItem => ({
  productId: "",
  productName: "",
  quantity: "",
  unit: "",
  purchasePrice: "",
  total: 0,
});

// ─── Product autocomplete ─────────────────────────────────────────────────────

function ProductAutocomplete({
  products,
  value,
  onChange,
}: {
  products: Product[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = products.find((p) => p.id === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        if (!selected) setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selected]);

  const filtered =
    query.trim() === ""
      ? []
      : products
          .filter(
            (p) =>
              p.name.toLowerCase().includes(query.toLowerCase()) ||
              (p.size ?? "").toLowerCase().includes(query.toLowerCase()) ||
              (p.category ?? "").toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 10);

  const pick = (p: Product) => {
    onChange(p.id);
    setQuery(p.name);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative", minWidth: "12rem" }}>
      <input
        type="text"
        value={open || !selected ? query : (selected?.name ?? "")}
        placeholder="Search product…"
        autoComplete="off"
        onFocus={() => { setQuery(""); setOpen(true); }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (!e.target.value) onChange("");
        }}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        style={{ minWidth: "12rem" }}
      />
      {open && (
        <div
          style={{
            position: "absolute", top: "100%", left: 0, zIndex: 50,
            background: "#fff", border: "2px solid #374151",
            borderRadius: "0.5rem", minWidth: "18rem",
            maxHeight: "14rem", overflowY: "auto",
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: "0.75rem 1rem", color: "#6b7280", fontSize: "0.85rem" }}>
              {query.trim() ? "No products found" : "Type to search…"}
            </div>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id} type="button" onMouseDown={() => pick(p)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "0.6rem 1rem", background: "none", border: "none",
                  cursor: "pointer", fontSize: "0.85rem", borderBottom: "1px solid #f3f4f6",
                }}
                onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.background = "#f9fafb")}
                onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.background = "none")}
              >
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                {p.size && <span style={{ color: "#6b7280", marginLeft: "0.5rem" }}>{p.size}</span>}
                <span style={{ color: "#6b7280", marginLeft: "0.5rem" }}>
                  · {p.unit}{p.stock !== undefined ? ` · Stock: ${p.stock}` : ""}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditPurchasePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [products, setProducts] = useState<Product[]>([]);
  const [supplierName, setSupplierName] = useState("");
  const [supplierInvoice, setSupplierInvoice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [prodSnap, purchaseSnap] = await Promise.all([
          getDocs(collection(db, "products")),
          getDoc(doc(db, "purchases", id)),
        ]);

        setProducts(
          prodSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, "id">) }))
        );

        if (!purchaseSnap.exists()) { setError("Purchase not found."); return; }

        const data = purchaseSnap.data();
        setSupplierName(data.supplierName || "");
        setSupplierInvoice(data.supplierInvoice || "");
        setPurchaseDate(data.purchaseDate || "");
        setItems(
          (data.items || []).length > 0
            ? (data.items as {
                productId: string; productName: string; quantity: number;
                unit: string; purchasePrice: number; total: number;
              }[]).map((item) => ({
                productId: item.productId || "",
                productName: item.productName || "",
                quantity: String(item.quantity ?? ""),
                unit: item.unit || "",
                purchasePrice: String(item.purchasePrice ?? ""),
                total: item.total ?? 0,
              }))
            : [emptyItem()]
        );
      } catch (err) {
        console.error(err);
        setError("Could not load purchase.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const updateItem = (index: number, field: keyof LineItem, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index] };
      if (field === "productId") {
        const product = products.find((p) => p.id === value);
        item.productId = value;
        item.productName = product?.name ?? "";
        item.unit = product?.unit ?? "";
        item.purchasePrice = product ? String(product.purchasePrice) : "";
      } else {
        (item as Record<string, unknown>)[field] = value;
      }
      const qty = parseFloat(field === "quantity" ? value : item.quantity);
      const price = parseFloat(field === "purchasePrice" ? value : item.purchasePrice);
      item.total = isNaN(qty) || isNaN(price) ? 0 : qty * price;
      next[index] = item;
      return next;
    });
  };

  const setItemProduct = (index: number, pid: string) => updateItem(index, "productId", pid);
  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));
  const totalAmount = items.reduce((sum, i) => sum + i.total, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!supplierName.trim()) { setError("Supplier name is required."); return; }
    if (items.some((i) => !i.productId || !i.quantity || !i.purchasePrice)) {
      setError("Please fill all product rows completely."); return;
    }

    try {
      setSaving(true);

      await runTransaction(db, async (transaction) => {
        // Read the existing purchase
        const purchaseRef = doc(db, "purchases", id);
        const purchaseSnap = await transaction.get(purchaseRef);
        if (!purchaseSnap.exists()) throw new Error("Purchase not found.");

        const oldItems = (purchaseSnap.data().items || []) as {
          productId?: string; quantity?: number; purchasePrice?: number;
          lotId?: string; purchasedAt?: string;
        }[];

        // Union of all affected product IDs
        const allProductIds = Array.from(
          new Set([
            ...oldItems.map((i) => i.productId).filter(Boolean),
            ...items.map((i) => i.productId),
          ] as string[])
        );

        // Read all affected products
        const snaps: Record<string, Awaited<ReturnType<typeof transaction.get>>> = {};
        for (const pid of allProductIds) {
          const snap = await transaction.get(doc(db, "products", pid));
          if (!snap.exists()) throw new Error(`Product no longer exists (id: ${pid}).`);
          snaps[pid] = snap;
        }

        // Build working lots map per product (start from current Firestore state)
        const lotsMap: Record<string, StockLot[]> = {};
        for (const pid of allProductIds) {
          lotsMap[pid] = normaliseLots({
            id: pid,
            ...(snaps[pid].data() as { stock?: number; purchasePrice?: number; stockLots?: StockLot[] }),
          });
        }

        // Step 1: Detect if items/quantities/prices were changed
        const itemsChanged =
          oldItems.length !== items.length ||
          oldItems.some((oldItem, idx) => {
            const newItem = items[idx];
            return (
              !newItem ||
              oldItem.productId !== newItem.productId ||
              Number(oldItem.quantity) !== Number(newItem.quantity) ||
              Number(oldItem.purchasePrice) !== Number(newItem.purchasePrice)
            );
          });

        if (!itemsChanged) {
          // Metadata-only update (supplier, invoice, date) — no risk of lot corruption or stealing
          const metaUpdate = sanitizeFirestoreData({
            supplierName: supplierName.trim(),
            supplierInvoice: supplierInvoice.trim(),
            purchaseDate,
            totalAmount,
          });
          transaction.update(purchaseRef, metaUpdate);
          return;
        }

        // Step 2: Reverse old purchase — verify none of the items were already sold
        for (const oldItem of oldItems) {
          const pid = oldItem.productId;
          if (!pid) continue;
          const qty = Number(oldItem.quantity) || 0;
          const productName = (snaps[pid].data() as { name?: string }).name ?? pid;

          if (oldItem.lotId) {
            checkPurchaseCanBeReversed(lotsMap[pid], oldItem.lotId, qty, productName);
            lotsMap[pid] = removeLotQuantity(lotsMap[pid], oldItem.lotId, qty);
          } else {
            // Legacy purchase without lotId: check if total stock is sufficient
            const currentStock = totalStock(lotsMap[pid]);
            if (currentStock < qty) {
              const sold = qty - currentStock;
              throw new Error(
                `Cannot modify purchase items for "${productName}": ${sold} unit(s) have already been sold in customer sales.`
              );
            }
            let rem = qty;
            lotsMap[pid] = [...lotsMap[pid]]
              .sort((a, b) => (a.purchasedAt ?? "").localeCompare(b.purchasedAt ?? ""))
              .map((l) => {
                if (rem <= 0) return l;
                const take = Math.min(l.quantity, rem);
                rem -= take;
                return { ...l, quantity: l.quantity - take };
              })
              .filter((l) => l.quantity > 0);
          }
        }

        // Step 3: Validate no negative stock before adding new
        for (const pid of allProductIds) {
          const ts = totalStock(lotsMap[pid]);
          if (ts < 0) {
            const name = (snaps[pid].data() as { name?: string }).name ?? pid;
            throw new Error(`Cannot update: stock of "${name}" would go negative after reversing old purchase.`);
          }
        }

        // Step 4: Apply new purchase — add/merge lots
        const newQtyMap: Record<string, { productId: string; qty: number; price: number }> = {};
        for (const item of items) {
          const key = `${item.productId}|${item.purchasePrice}`;
          if (!newQtyMap[key]) newQtyMap[key] = { productId: item.productId, qty: 0, price: Number(item.purchasePrice) };
          newQtyMap[key].qty += Number(item.quantity);
        }

        const newLotIdMap: Record<string, string> = {};
        for (const key of Object.keys(newQtyMap)) {
          const { productId: pid, qty, price } = newQtyMap[key];
          const result = addLot(lotsMap[pid], price, qty, purchaseDate);
          lotsMap[pid] = result.lots;
          newLotIdMap[key] = result.lotId;
        }

        // Step 5: Update purchase document
        const purchaseUpdate = sanitizeFirestoreData({
          supplierName: supplierName.trim(),
          supplierInvoice: supplierInvoice.trim(),
          purchaseDate,
          items: items.map((item) => {
            const key = `${item.productId}|${item.purchasePrice}`;
            return {
              productId: item.productId,
              productName: item.productName,
              quantity: Number(item.quantity),
              unit: item.unit,
              purchasePrice: Number(item.purchasePrice),
              total: item.total,
              lotId: newLotIdMap[key] ?? "",
              purchasedAt: purchaseDate,
            };
          }),
          totalAmount,
        });
        transaction.update(purchaseRef, purchaseUpdate);

        // Step 6: Update each product's stockLots + stock
        for (const pid of allProductIds) {
          const productUpdate = sanitizeFirestoreData({
            stockLots: lotsMap[pid],
            stock: totalStock(lotsMap[pid]),
          });
          transaction.update(doc(db, "products", pid), productUpdate);
        }
      });

      router.push("/dashboard/purchases");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Could not update purchase.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="page-main">
        <div className="page-content"><div className="card">Loading purchase...</div></div>
      </main>
    );
  }

  return (
    <main className="page-main">
      <header className="site-header">
        <h1 className="text-xl">Gaurav Marbles</h1>
        <p className="text-muted">Edit Purchase</p>
      </header>

      <div className="page-content-narrow purchase-page-content">
        <button onClick={() => router.push("/dashboard/purchases")} className="btn-ghost">
          ← Back to Purchases
        </button>
        <h2 className="mt-4 mb-6 text-2xl">Edit Purchase</h2>

        <form onSubmit={handleSubmit}>
          {/* Supplier Details */}
          <div className="card mb-6">
            <h3 className="text-base font-semibold mb-4">Supplier Details</h3>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div className="form-field">
                <label htmlFor="supplierName">Supplier Name *</label>
                <input id="supplierName" type="text" value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)} required />
              </div>
              <div className="form-field">
                <label htmlFor="supplierInvoice">Invoice Number</label>
                <input id="supplierInvoice" type="text" value={supplierInvoice}
                  onChange={(e) => setSupplierInvoice(e.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="purchaseDate">Purchase Date *</label>
                <input id="purchaseDate" type="date" value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)} required />
              </div>
            </div>
          </div>

          {/* Products */}
          <div className="card mb-6">
            <h3 className="text-base font-semibold mb-4">Products</h3>
            <div className="overflow-x-auto">
              <table className="purchase-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Purchase Price (₹)</th>
                    <th>Total (₹)</th>
                    <th style={{ width: "3rem" }} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <ProductAutocomplete
                          products={products}
                          value={item.productId}
                          onChange={(pid) => setItemProduct(index, pid)}
                        />
                      </td>
                      <td>
                        <input type="number" min="0.01" step="any" value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", e.target.value)}
                          required className="quantity-input" />
                      </td>
                      <td>
                        <input type="text" value={item.unit}
                          onChange={(e) => updateItem(index, "unit", e.target.value)}
                          className="unit-input" />
                      </td>
                      <td>
                        <input type="number" min="0" step="any" value={item.purchasePrice}
                          onChange={(e) => updateItem(index, "purchasePrice", e.target.value)}
                          required className="price-input" />
                      </td>
                      <td className="purchase-row-total">
                        ₹{item.total.toLocaleString("en-IN")}
                      </td>
                      <td>
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(index)}
                            className="remove-item-button">×</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addItem}
              className="btn-secondary mt-4 purchase-add-row-button">
              + Add Product Row
            </button>
          </div>

          {/* Total */}
          <div className="card mb-6">
            <div className="flex justify-end">
              <div className="purchase-total">
                <div className="purchase-total-row">
                  <span>Total Amount</span>
                  <span>₹{totalAmount.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>
          </div>

          {error && <p className="text-error mb-4">{error}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => router.push("/dashboard/purchases")}
              className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving..." : "Update Purchase"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
