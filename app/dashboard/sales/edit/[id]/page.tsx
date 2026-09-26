"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  allocateFifo,
  normaliseLots,
  restoreFromAllocations,
  totalStock,
  type CostAllocation,
  type StockLot,
} from "@/lib/stockLots";

// ─── Types ────────────────────────────────────────────────────────────────────

type Product = {
  id: string;
  name: string;
  unit: string;
  sellingPrice: number;
  purchasePrice: number;
  stock: number;
  size?: string;
  category?: string;
  stockLots?: StockLot[];
};

type Customer = {
  id: string;
  name: string;
  phone: string;
};

type SavedItem = {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  sellingPrice: number;
  costPrice?: number;
  costTotal?: number;
  costAllocations?: CostAllocation[];
  total: number;
};

type LineItem = {
  productId: string;
  productName: string;
  quantity: string;
  unit: string;
  sellingPrice: string;
  costPrice: number;
  costTotal: number;
  costAllocations: CostAllocation[];
  total: number;
};

const emptyItem = (): LineItem => ({
  productId: "", productName: "", quantity: "", unit: "",
  sellingPrice: "", costPrice: 0, costTotal: 0, costAllocations: [], total: 0,
});

// ─── Autocomplete components (same as add page) ───────────────────────────────

function CustomerAutocomplete({
  customers, value, onSelect,
}: { customers: Customer[]; value: string; onSelect: (c: Customer | null) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = customers.find((c) => c.id === value);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = query.trim() === "" ? [] : customers
    .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query))
    .slice(0, 8);

  const pick = (c: Customer) => { onSelect(c); setQuery(c.name); setOpen(false); };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input type="text"
        value={open || !selected ? query : selected.name}
        placeholder="Search customer…" autoComplete="off"
        onFocus={() => { setQuery(""); setOpen(true); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onSelect(null); }}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
      />
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 50, background: "#fff", border: "2px solid #374151", borderRadius: "0.5rem", minWidth: "100%", maxWidth: "28rem", maxHeight: "14rem", overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.12)" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "0.75rem 1rem", color: "#6b7280", fontSize: "0.85rem" }}>
              {query.trim() ? "No customers found" : "Type to search…"}
            </div>
          ) : filtered.map((c) => (
            <button key={c.id} type="button" onMouseDown={() => pick(c)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "0.6rem 1rem", background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", borderBottom: "1px solid #f3f4f6" }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.background = "#f9fafb")}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.background = "none")}>
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              {c.phone && <span style={{ color: "#6b7280", marginLeft: "0.5rem" }}>{c.phone}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductAutocomplete({
  products, value, onChange,
}: { products: Product[]; value: string; onChange: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = products.find((p) => p.id === value);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); if (!selected) setQuery(""); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [selected]);

  const filtered = query.trim() === "" ? [] : products
    .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()) || (p.size ?? "").toLowerCase().includes(query.toLowerCase()) || (p.category ?? "").toLowerCase().includes(query.toLowerCase()))
    .slice(0, 10);

  const pick = (p: Product) => { onChange(p.id); setQuery(p.name); setOpen(false); };

  return (
    <div ref={ref} style={{ position: "relative", minWidth: "12rem" }}>
      <input type="text"
        value={open || !selected ? query : (selected?.name ?? "")}
        placeholder="Search product…" autoComplete="off"
        onFocus={() => { setQuery(""); setOpen(true); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(""); }}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        style={{ minWidth: "12rem" }}
      />
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 50, background: "#fff", border: "2px solid #374151", borderRadius: "0.5rem", minWidth: "20rem", maxHeight: "14rem", overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.12)" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "0.75rem 1rem", color: "#6b7280", fontSize: "0.85rem" }}>
              {query.trim() ? "No products found" : "Type to search…"}
            </div>
          ) : filtered.map((p) => (
            <button key={p.id} type="button" onMouseDown={() => pick(p)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "0.6rem 1rem", background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", borderBottom: "1px solid #f3f4f6" }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.background = "#f9fafb")}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.background = "none")}>
              <span style={{ fontWeight: 600 }}>{p.name}</span>
              {p.size && <span style={{ color: "#6b7280", marginLeft: "0.5rem" }}>{p.size}</span>}
              <span style={{ color: "#6b7280", marginLeft: "0.5rem" }}>· {p.unit} · Stock: {p.stock} · ₹{p.sellingPrice}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function EditSaleContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const saleId = params.id as string;
  const returnTo = searchParams.get("returnTo") || `/dashboard/sales/${saleId}`;

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [saleDate, setSaleDate] = useState("");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [prodSnap, custSnap, saleSnap] = await Promise.all([
          getDocs(collection(db, "products")),
          getDocs(collection(db, "customers")),
          getDoc(doc(db, "sales", saleId)),
        ]);

        const productList = prodSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, "id">) }));
        const customerList = custSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Customer, "id">) }));
        setProducts(productList);
        setCustomers(customerList);

        if (!saleSnap.exists()) { setError("Sale not found."); return; }

        const sale = saleSnap.data() as {
          customerId?: string; customerName: string; customerPhone: string;
          saleDate: string; dueDate?: string; receivedAmount?: number; paidAmount?: number;
          items?: SavedItem[];
        };
        setCustomerId(sale.customerId || "");
        setCustomerName(sale.customerName || "");
        setCustomerPhone(sale.customerPhone || "");
        setSaleDate(sale.saleDate || "");
        setDueDate(sale.dueDate || "");
        const existingPaid = sale.receivedAmount !== undefined ? sale.receivedAmount : sale.paidAmount;
        setReceivedAmount(existingPaid !== undefined ? String(existingPaid) : "");

        setItems(
          sale.items?.length
            ? sale.items.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                quantity: String(item.quantity),
                unit: item.unit,
                sellingPrice: String(item.sellingPrice),
                costPrice: item.costPrice ?? 0,
                costTotal: item.costTotal ?? (item.costPrice ? item.costPrice * item.quantity : 0),
                costAllocations: item.costAllocations ?? [],
                total: item.total,
              }))
            : [emptyItem()]
        );
      } catch (err) {
        console.error(err);
        setError("Could not load sale.");
      } finally {
        setLoading(false);
      }
    };
    if (saleId) load();
  }, [saleId]);

  // ── FIFO helper ─────────────────────────────────────────────────────────────

  const computeFifoCost = (product: Product, quantity: number) => {
    const lots = normaliseLots({ stock: product.stock, purchasePrice: product.purchasePrice, stockLots: product.stockLots });
    try {
      const { allocations, costTotal, costPrice } = allocateFifo(lots, quantity, product.name);
      return { costPrice, costTotal, costAllocations: allocations };
    } catch {
      return { costPrice: product.purchasePrice ?? 0, costTotal: quantity * (product.purchasePrice ?? 0), costAllocations: [] as CostAllocation[] };
    }
  };

  // ── Item helpers ────────────────────────────────────────────────────────────

  const setItemProduct = (index: number, productId: string) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index] };
      const product = products.find((p) => p.id === productId);
      item.productId = productId;
      item.productName = product?.name ?? "";
      item.unit = product?.unit ?? "";
      item.sellingPrice = product ? String(product.sellingPrice) : "";
      if (product) {
        const qty = parseFloat(item.quantity);
        if (!isNaN(qty) && qty > 0) {
          const { costPrice, costTotal, costAllocations } = computeFifoCost(product, qty);
          item.costPrice = costPrice; item.costTotal = costTotal; item.costAllocations = costAllocations;
        } else {
          item.costPrice = product.purchasePrice ?? 0; item.costTotal = 0; item.costAllocations = [];
        }
      }
      const sp = parseFloat(item.sellingPrice);
      const qty = parseFloat(item.quantity);
      item.total = isNaN(qty) || isNaN(sp) ? 0 : qty * sp;
      next[index] = item;
      return next;
    });
  };

  const updateItem = (index: number, field: "quantity" | "sellingPrice" | "unit", value: string) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index] };
      (item as Record<string, unknown>)[field] = value;
      if (field === "quantity") {
        const qty = parseFloat(value);
        const product = products.find((p) => p.id === item.productId);
        if (product && !isNaN(qty) && qty > 0) {
          const { costPrice, costTotal, costAllocations } = computeFifoCost(product, qty);
          item.costPrice = costPrice; item.costTotal = costTotal; item.costAllocations = costAllocations;
        } else {
          item.costTotal = 0; item.costAllocations = [];
        }
      }
      const sp = parseFloat(item.sellingPrice);
      const qty = parseFloat(item.quantity);
      item.total = isNaN(qty) || isNaN(sp) ? 0 : qty * sp;
      next[index] = item;
      return next;
    });
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const totalAmount = items.reduce((s, i) => s + i.total, 0);

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!customerName.trim()) { setError("Customer name is required."); return; }
    if (!saleDate) { setError("Sale date is required."); return; }
    if (items.some((i) => !i.productId || !i.quantity || !i.sellingPrice)) {
      setError("Please fill all product rows completely."); return;
    }

    const numericReceived = receivedAmount.trim() === "" ? 0 : Number(receivedAmount);
    if (isNaN(numericReceived) || !Number.isFinite(numericReceived) || numericReceived < 0) {
      setError("Received amount must be a valid non-negative number.");
      return;
    }

    try {
      setSaving(true);
      const saleRef = doc(db, "sales", saleId);

      await runTransaction(db, async (transaction) => {
        const saleSnap = await transaction.get(saleRef);
        if (!saleSnap.exists()) throw new Error("Sale no longer exists.");

        const oldSale = saleSnap.data() as { saleDate?: string; items?: SavedItem[] };
        const oldItems = oldSale.items || [];

        // Union of all affected product IDs
        const allProductIds = Array.from(new Set([
          ...oldItems.map((i) => i.productId),
          ...items.map((i) => i.productId),
        ]));

        // Read all products
        const snaps: Record<string, Awaited<ReturnType<typeof transaction.get>>> = {};
        for (const pid of allProductIds) {
          const snap = await transaction.get(doc(db, "products", pid));
          if (!snap.exists()) throw new Error(`Product no longer exists (id: ${pid}).`);
          snaps[pid] = snap;
        }

        // Build working lots
        const lotsMap: Record<string, StockLot[]> = {};
        for (const pid of allProductIds) {
          lotsMap[pid] = normaliseLots({
            id: pid,
            ...(snaps[pid].data() as { stock?: number; purchasePrice?: number; stockLots?: StockLot[] }),
          });
        }

        // Step 1: Restore old sale's stock to lots using preserved original purchase dates
        for (const oldItem of oldItems) {
          const pid = oldItem.productId;
          if (!pid) continue;
          if (oldItem.costAllocations?.length) {
            lotsMap[pid] = restoreFromAllocations(lotsMap[pid], oldItem.costAllocations);
          } else {
            // Legacy fallback: restore a single block at costPrice with earliest epoch date
            const costPrice = oldItem.costPrice ?? 0;
            lotsMap[pid] = restoreFromAllocations(
              lotsMap[pid],
              [{
                lotId: `legacy_${pid}`,
                purchasePrice: costPrice,
                quantity: oldItem.quantity,
                totalCost: costPrice * oldItem.quantity,
                purchasedAt: "2000-01-01",
              }],
              "2000-01-01"
            );
          }
        }

        // Step 2: Validate new quantities against restored stock
        const txQty: Record<string, number> = {};
        for (const item of items) {
          txQty[item.productId] = (txQty[item.productId] || 0) + Number(item.quantity);
        }
        for (const [pid, qty] of Object.entries(txQty)) {
          const avail = totalStock(lotsMap[pid]);
          if (qty > avail) {
            const name = (snaps[pid].data() as { name?: string }).name ?? pid;
            throw new Error(`Not enough stock for "${name}". Available: ${avail}, requested: ${qty}.`);
          }
        }

        // Step 3: FIFO allocate new items
        const savedItems = items.map((item) => {
          const qty = Number(item.quantity);
          const { allocations, updatedLots, costTotal, costPrice } = allocateFifo(
            lotsMap[item.productId], qty, item.productName
          );
          lotsMap[item.productId] = updatedLots;
          return {
            productId: item.productId,
            productName: item.productName,
            quantity: qty,
            unit: item.unit,
            sellingPrice: Number(item.sellingPrice),
            costPrice,
            costTotal,
            costAllocations: allocations,
            total: item.total,
          };
        });

        // Step 4: Update products
        for (const pid of allProductIds) {
          transaction.update(doc(db, "products", pid), {
            stockLots: lotsMap[pid],
            stock: totalStock(lotsMap[pid]),
          });
        }

        // Step 5: Update sale
        transaction.update(saleRef, {
          customerId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          saleDate,
          dueDate: dueDate.trim(),
          items: savedItems,
          totalAmount,
          receivedAmount: numericReceived,
          paidAmount: numericReceived,
        });
      });

      router.push(returnTo);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Could not update sale.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="page-main">
        <header className="site-header"><h1 className="text-xl">Gaurav Marbles</h1><p className="text-muted">Edit Sale</p></header>
        <div className="page-content"><div className="card text-center">Loading sale...</div></div>
      </main>
    );
  }

  return (
    <main className="page-main">
      <header className="site-header">
        <h1 className="text-xl">Gaurav Marbles</h1>
        <p className="text-muted">Edit Sale</p>
      </header>

      <div className="page-content-narrow purchase-page-content">
        <button onClick={() => router.push(returnTo)} className="btn-ghost">
          ← Back to Sale
        </button>
        <h2 className="mt-4 mb-6 text-2xl">Edit Sale</h2>

        <form onSubmit={handleSubmit}>
          {/* Customer */}
          <div className="card mb-6">
            <h3 className="text-base font-semibold mb-4">Customer Details</h3>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div className="form-field">
                <label>Customer *</label>
                <CustomerAutocomplete
                  customers={customers}
                  value={customerId}
                  onSelect={(c) => {
                    if (c) { setCustomerId(c.id); setCustomerName(c.name); setCustomerPhone(c.phone); }
                    else { setCustomerId(""); }
                  }}
                />
              </div>
              <div className="form-field">
                <label htmlFor="customerPhone">Phone Number</label>
                <input id="customerPhone" type="tel" value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="saleDate">Sale Date *</label>
                <input id="saleDate" type="date" value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)} required />
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
                    <th>Product</th><th>Qty</th><th>Unit</th>
                    <th>Selling Price (₹)</th><th>Cost (₹)</th><th>Total (₹)</th>
                    <th style={{ width: "3rem" }} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <ProductAutocomplete products={products} value={item.productId}
                          onChange={(pid) => setItemProduct(index, pid)} />
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
                        <input type="number" min="0" step="any" value={item.sellingPrice}
                          onChange={(e) => updateItem(index, "sellingPrice", e.target.value)}
                          required className="price-input" />
                      </td>
                      <td>
                        <span style={{ fontSize: "0.85rem", color: "#6b7280", padding: "0 0.25rem" }}>
                          {item.costTotal > 0 ? `₹${item.costTotal.toLocaleString("en-IN")}` : "—"}
                        </span>
                      </td>
                      <td className="purchase-row-total">₹{item.total.toLocaleString("en-IN")}</td>
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

          {/* Payment & Invoicing */}
          <div className="card mb-6">
            <h3 className="text-base font-semibold mb-4">Payment & Invoicing</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
              <div className="form-field">
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="receivedAmount">Amount Received (₹)</label>
                  <button
                    type="button"
                    onClick={() => setReceivedAmount(String(totalAmount))}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Full Paid
                  </button>
                </div>
                <input
                  id="receivedAmount"
                  type="number"
                  min="0"
                  step="any"
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  placeholder="0 (or click Full Paid)"
                />
              </div>

              <div className="form-field">
                <label htmlFor="dueDate">Payment Due Date (Optional)</label>
                <input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="purchase-total" style={{ width: "100%" }}>
                <div className="purchase-total-row">
                  <span>Total Amount</span>
                  <span>₹{totalAmount.toLocaleString("en-IN")}</span>
                </div>
                <div className="purchase-total-row" style={{ color: "#16a34a", fontSize: "0.95rem" }}>
                  <span>Received</span>
                  <span>₹{(Number(receivedAmount) || 0).toLocaleString("en-IN")}</span>
                </div>
                <div
                  className="purchase-total-row"
                  style={{
                    borderTop: "1px solid #e5e7eb",
                    marginTop: "0.25rem",
                    paddingTop: "0.25rem",
                    color: totalAmount - (Number(receivedAmount) || 0) > 0 ? "#dc2626" : "#16a34a",
                    fontWeight: 700,
                  }}
                >
                  <span>Balance Due</span>
                  <span>₹{Math.max(0, totalAmount - (Number(receivedAmount) || 0)).toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>
          </div>

          {error && <p className="text-error mb-4">{error}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => router.push(returnTo)}
              className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default function EditSalePage() {
  return (
    <Suspense
      fallback={
        <main className="page-main">
          <header className="site-header">
            <h1 className="text-xl">Gaurav Marbles</h1>
            <p className="text-muted">Edit Sale</p>
          </header>
          <div className="page-content">
            <div className="card text-center">Loading sale...</div>
          </div>
        </main>
      }
    >
      <EditSaleContent />
    </Suspense>
  );
}
