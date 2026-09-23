"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  getDocs,
  getCountFromServer,
  runTransaction,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import {
  allocateFifo,
  normaliseLots,
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

type LineItem = {
  productId: string;
  productName: string;
  quantity: string;
  unit: string;
  sellingPrice: string;
  // computed from FIFO — shown read-only
  costPrice: number;
  costTotal: number;
  costAllocations: CostAllocation[];
  total: number;
};

const emptyItem = (): LineItem => ({
  productId: "",
  productName: "",
  quantity: "",
  unit: "",
  sellingPrice: "",
  costPrice: 0,
  costTotal: 0,
  costAllocations: [],
  total: 0,
});

// ─── Customer autocomplete ────────────────────────────────────────────────────

function CustomerAutocomplete({
  customers,
  value,
  onSelect,
}: {
  customers: Customer[];
  value: string; // customerId
  onSelect: (c: Customer | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = customers.find((c) => c.id === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered =
    query.trim() === ""
      ? []
      : customers
          .filter(
            (c) =>
              c.name.toLowerCase().includes(query.toLowerCase()) ||
              c.phone.includes(query)
          )
          .slice(0, 8);

  const pick = (c: Customer) => {
    onSelect(c);
    setQuery(c.name);
    setOpen(false);
  };

  const clear = () => {
    onSelect(null);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        type="text"
        value={open || !selected ? query : selected.name}
        placeholder="Search customer by name or phone…"
        autoComplete="off"
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (!e.target.value) clear();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <div
          style={{
            position: "absolute", top: "100%", left: 0, zIndex: 50,
            background: "#fff", border: "2px solid #374151",
            borderRadius: "0.5rem", minWidth: "100%", maxWidth: "28rem",
            maxHeight: "14rem", overflowY: "auto",
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: "0.75rem 1rem", color: "#6b7280", fontSize: "0.85rem" }}>
              {query.trim() ? "No customers found" : "Type to search…"}
            </div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={() => pick(c)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "0.6rem 1rem", background: "none", border: "none",
                  cursor: "pointer", fontSize: "0.85rem", borderBottom: "1px solid #f3f4f6",
                }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.background = "#f9fafb")}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.background = "none")}
              >
                <span style={{ fontWeight: 600 }}>{c.name}</span>
                {c.phone && (
                  <span style={{ color: "#6b7280", marginLeft: "0.5rem" }}>{c.phone}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

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
            borderRadius: "0.5rem", minWidth: "20rem",
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
                onMouseEnter={(e) => ((e.target as HTMLElement).style.background = "#f9fafb")}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.background = "none")}
              >
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                {p.size && <span style={{ color: "#6b7280", marginLeft: "0.5rem" }}>{p.size}</span>}
                <span style={{ color: "#6b7280", marginLeft: "0.5rem" }}>
                  · {p.unit} · Stock: {p.stock} · ₹{p.sellingPrice}
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

export default function AddSalePage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [saleDate, setSaleDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [receivedAmount, setReceivedAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isSubmittingRef = useRef(false);

  // Payment method & split states
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [cashAmount, setCashAmount] = useState("");
  const [upiAmount, setUpiAmount] = useState("");
  const [bankAmount, setBankAmount] = useState("");
  const [creditAmount, setCreditAmount] = useState("");

  const handlePaymentMethodChange = (newMethod: string, currentTotal: number) => {
    setPaymentMethod(newMethod);
    if (newMethod === "Cash") {
      setReceivedAmount(String(currentTotal));
      setCashAmount(String(currentTotal));
      setUpiAmount("");
      setBankAmount("");
      setCreditAmount("");
    } else if (newMethod === "UPI") {
      setReceivedAmount(String(currentTotal));
      setCashAmount("");
      setUpiAmount(String(currentTotal));
      setBankAmount("");
      setCreditAmount("");
    } else if (newMethod === "Bank") {
      setReceivedAmount(String(currentTotal));
      setCashAmount("");
      setUpiAmount("");
      setBankAmount(String(currentTotal));
      setCreditAmount("");
    } else if (newMethod === "Credit / Due") {
      setReceivedAmount("0");
      setCashAmount("");
      setUpiAmount("");
      setBankAmount("");
      setCreditAmount(String(currentTotal));
    } else if (newMethod === "Split") {
      setReceivedAmount("0");
      setCashAmount("");
      setUpiAmount("");
      setBankAmount("");
      setCreditAmount("");
    }
  };

  const autoBalanceSaleSplit = (currentTotal: number) => {
    const c = Number(cashAmount || 0);
    const u = Number(upiAmount || 0);
    const b = Number(bankAmount || 0);
    const rec = c + u + b;
    setReceivedAmount(String(rec));
    const due = Math.max(0, currentTotal - rec);
    setCreditAmount(String(due));
  };

  useEffect(() => {
    const load = async () => {
      const [prodSnap, custSnap] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "customers")),
      ]);
      setProducts(prodSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, "id">) })));
      setCustomers(custSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Customer, "id">) })));
    };
    load();
  }, []);

  // ── Compute FIFO cost for a row whenever product or quantity changes ──────

  const computeFifoCost = (
    product: Product,
    quantity: number
  ): { costPrice: number; costTotal: number; costAllocations: CostAllocation[] } => {
    if (!product || quantity <= 0) return { costPrice: 0, costTotal: 0, costAllocations: [] };
    const lots = normaliseLots({
      stock: product.stock,
      purchasePrice: product.purchasePrice,
      stockLots: product.stockLots,
    });
    try {
      const { allocations, costTotal, costPrice } = allocateFifo(lots, quantity, product.name);
      return { costPrice, costTotal, costAllocations: allocations };
    } catch {
      return { costPrice: product.purchasePrice ?? 0, costTotal: quantity * (product.purchasePrice ?? 0), costAllocations: [] };
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
      // Recalculate FIFO cost
      if (product) {
        const qty = parseFloat(item.quantity);
        if (!isNaN(qty) && qty > 0) {
          const { costPrice, costTotal, costAllocations } = computeFifoCost(product, qty);
          item.costPrice = costPrice;
          item.costTotal = costTotal;
          item.costAllocations = costAllocations;
        } else {
          item.costPrice = product.purchasePrice ?? 0;
          item.costTotal = 0;
          item.costAllocations = [];
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
          item.costPrice = costPrice;
          item.costTotal = costTotal;
          item.costAllocations = costAllocations;
        } else {
          item.costTotal = 0;
          item.costAllocations = [];
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
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));
  const totalAmount = items.reduce((s, i) => s + i.total, 0);

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isSubmittingRef.current || saving) return;

    if (!customerName.trim()) { setError("Customer name is required."); return; }
    if (items.some((i) => !i.productId || !i.quantity || !i.sellingPrice)) {
      setError("Please fill all product rows completely."); return;
    }

    // Early UI stock validation (aggregated)
    const uiQty: Record<string, number> = {};
    for (const item of items) {
      const qty = Number(item.quantity);
      if (!Number.isFinite(qty) || qty <= 0) { setError("Quantity must be greater than 0."); return; }
      uiQty[item.productId] = (uiQty[item.productId] || 0) + qty;
    }
    for (const [pid, qty] of Object.entries(uiQty)) {
      const product = products.find((p) => p.id === pid);
      if (!product) { setError("A selected product could not be found."); return; }
      if (qty > product.stock) {
        setError(`Not enough stock for "${product.name}". Available: ${product.stock}, requested: ${qty}.`);
        return;
      }
    }

    const numericReceived = receivedAmount.trim() === "" ? 0 : Number(receivedAmount);
    if (isNaN(numericReceived) || !Number.isFinite(numericReceived) || numericReceived < 0) {
      setError("Received amount must be a valid non-negative number.");
      return;
    }

    let finalCash = 0;
    let finalUpi = 0;
    let finalBank = 0;
    let finalCredit = 0;

    if (paymentMethod === "Cash") {
      finalCash = numericReceived;
      finalCredit = Math.max(0, totalAmount - numericReceived);
    } else if (paymentMethod === "UPI") {
      finalUpi = numericReceived;
      finalCredit = Math.max(0, totalAmount - numericReceived);
    } else if (paymentMethod === "Bank") {
      finalBank = numericReceived;
      finalCredit = Math.max(0, totalAmount - numericReceived);
    } else if (paymentMethod === "Credit / Due") {
      finalCredit = totalAmount;
    } else if (paymentMethod === "Split") {
      finalCash = Number(cashAmount || 0);
      finalUpi = Number(upiAmount || 0);
      finalBank = Number(bankAmount || 0);
      finalCredit = Number(creditAmount || 0);
      const sum = finalCash + finalUpi + finalBank + finalCredit;
      if (Math.abs(sum - totalAmount) > 0.01) {
        setError(
          `Split amounts sum (₹${sum.toLocaleString("en-IN")}) must equal Total Amount (₹${totalAmount.toLocaleString("en-IN")}).`
        );
        return;
      }
    }

    try {
      isSubmittingRef.current = true;
      setSaving(true);

      // Baseline count in case counters collection is uninitialized
      const countSnap = await getCountFromServer(collection(db, "sales"));
      const fallbackCount = countSnap.data().count;

      await runTransaction(db, async (transaction) => {
        // ── READ PHASE: All reads strictly executed before any writes ──
        const counterRef = doc(db, "counters", "sales");
        const counterSnap = await transaction.get(counterRef);

        // Unique product IDs
        const productIds = Array.from(new Set(items.map((i) => i.productId)));

        // Read all products inside the transaction
        const snaps: Record<string, Awaited<ReturnType<typeof transaction.get>>> = {};
        for (const pid of productIds) {
          const snap = await transaction.get(doc(db, "products", pid));
          if (!snap.exists()) {
            const name = items.find((i) => i.productId === pid)?.productName ?? pid;
            throw new Error(`Product "${name}" no longer exists.`);
          }
          snaps[pid] = snap;
        }

        // ── CALCULATION & VALIDATION PHASE ──
        const saleNumber = counterSnap.exists()
          ? (Number(counterSnap.data().lastSaleNumber) || 0) + 1
          : fallbackCount + 1;

        // Build working lots per product with deterministic ID
        const lotsMap: Record<string, StockLot[]> = {};
        for (const pid of productIds) {
          lotsMap[pid] = normaliseLots({
            id: pid,
            ...(snaps[pid].data() as { stock?: number; purchasePrice?: number; stockLots?: StockLot[] }),
          });
        }

        // Validate aggregate stock inside transaction
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

        // FIFO allocate per item (each row independently for correct per-item cost)
        const savedItems = items.map((item) => {
          const qty = Number(item.quantity);
          const { allocations, updatedLots, costTotal, costPrice } = allocateFifo(
            lotsMap[item.productId],
            qty,
            item.productName
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

        // ── WRITE PHASE: All writes executed atomically together ──
        // 1. Update atomic sale counter
        transaction.set(counterRef, { lastSaleNumber: saleNumber }, { merge: true });

        // 2. Create sale document
        const saleRef = doc(collection(db, "sales"));
        transaction.set(saleRef, {
          saleNumber,
          customerId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          saleDate,
          dueDate: dueDate.trim(),
          items: savedItems,
          totalAmount,
          receivedAmount: numericReceived,
          paidAmount: numericReceived,
          paymentMethod,
          cashAmount: finalCash,
          upiAmount: finalUpi,
          bankAmount: finalBank,
          creditAmount: finalCredit,
          createdAt: new Date(),
        });

        // 3. Update each product's lots and total stock
        for (const pid of productIds) {
          transaction.update(doc(db, "products", pid), {
            stockLots: lotsMap[pid],
            stock: totalStock(lotsMap[pid]),
          });
        }
      });

      router.push("/dashboard/sales");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Could not save sale.");
    } finally {
      setSaving(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <main className="page-main">
      <header className="site-header">
        <h1 className="text-xl">Gaurav Marbles</h1>
        <p className="text-muted">New Sale</p>
      </header>

      <div className="page-content-narrow purchase-page-content">
        <button onClick={() => router.push("/dashboard/sales")} className="btn-ghost">
          ← Back to Sales
        </button>
        <h2 className="mt-4 mb-6 text-2xl">New Sale</h2>

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
                    if (c) {
                      setCustomerId(c.id);
                      setCustomerName(c.name);
                      setCustomerPhone(c.phone);
                    } else {
                      setCustomerId("");
                      setCustomerName("");
                      setCustomerPhone("");
                    }
                  }}
                />
              </div>
              <div className="form-field">
                <label htmlFor="customerPhone">Phone Number</label>
                <input
                  id="customerPhone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="9876543210"
                />
              </div>
              <div className="form-field">
                <label htmlFor="saleDate">Sale Date *</label>
                <input
                  id="saleDate"
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  required
                />
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
                    <th>Selling Price (₹)</th>
                    <th>Cost (₹)</th>
                    <th>Total (₹)</th>
                    <th style={{ width: "3rem" }}></th>
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
                        <input
                          type="number" min="0.01" step="any"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", e.target.value)}
                          placeholder="0" required className="quantity-input"
                        />
                      </td>
                      <td>
                        <input
                          type="text" value={item.unit}
                          onChange={(e) => updateItem(index, "unit", e.target.value)}
                          className="unit-input"
                        />
                      </td>
                      <td>
                        <input
                          type="number" min="0" step="any"
                          value={item.sellingPrice}
                          onChange={(e) => updateItem(index, "sellingPrice", e.target.value)}
                          placeholder="0" required className="price-input"
                        />
                      </td>
                      <td>
                        <span style={{ fontSize: "0.85rem", color: "#6b7280", padding: "0 0.25rem" }}>
                          {item.costTotal > 0
                            ? `₹${item.costTotal.toLocaleString("en-IN")}`
                            : "—"}
                        </span>
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

          {/* Payment & Invoicing */}
          <div className="card mb-6">
            <h3 className="text-base font-semibold mb-4 pb-2 border-b border-gray-100">
              Payment &amp; Invoicing
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
              <div className="form-field">
                <label htmlFor="paymentMethod">Payment Method *</label>
                <select
                  id="paymentMethod"
                  value={paymentMethod}
                  onChange={(e) => handlePaymentMethodChange(e.target.value, totalAmount)}
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank">Bank Transfer</option>
                  <option value="Credit / Due">Credit / Due (Fully Unpaid)</option>
                  <option value="Split">Split Payment</option>
                </select>
              </div>

              {paymentMethod !== "Split" && paymentMethod !== "Credit / Due" && (
                <div className="form-field">
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="receivedAmount">Amount Received ({paymentMethod}) (₹)</label>
                    <button
                      type="button"
                      onClick={() => {
                        setReceivedAmount(String(totalAmount));
                        if (paymentMethod === "Cash") setCashAmount(String(totalAmount));
                        if (paymentMethod === "UPI") setUpiAmount(String(totalAmount));
                        if (paymentMethod === "Bank") setBankAmount(String(totalAmount));
                      }}
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
                    onChange={(e) => {
                      const val = e.target.value;
                      setReceivedAmount(val);
                      if (paymentMethod === "Cash") setCashAmount(val);
                      if (paymentMethod === "UPI") setUpiAmount(val);
                      if (paymentMethod === "Bank") setBankAmount(val);
                    }}
                    placeholder="0 (or click Full Paid)"
                  />
                </div>
              )}

              {paymentMethod === "Credit / Due" && (
                <div className="form-field">
                  <label>Credit / Due Amount (₹)</label>
                  <input
                    type="text"
                    disabled
                    value={`₹${totalAmount.toLocaleString("en-IN")}`}
                    className="bg-gray-100 font-semibold text-gray-800"
                  />
                </div>
              )}

              <div className="form-field">
                <label htmlFor="dueDate">Payment Due Date (Optional)</label>
                <input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            {/* Split Breakdown */}
            {paymentMethod === "Split" && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-700 mb-3">
                  Enter payment split breakdown (must sum to total ₹{totalAmount.toLocaleString("en-IN")}):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="form-field">
                    <label htmlFor="cashAmount">Cash Amount (₹)</label>
                    <input
                      id="cashAmount"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={cashAmount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCashAmount(val);
                        const c = Number(val || 0);
                        const u = Number(upiAmount || 0);
                        const b = Number(bankAmount || 0);
                        setReceivedAmount(String(c + u + b));
                      }}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="upiAmount">UPI Amount (₹)</label>
                    <input
                      id="upiAmount"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={upiAmount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setUpiAmount(val);
                        const c = Number(cashAmount || 0);
                        const u = Number(val || 0);
                        const b = Number(bankAmount || 0);
                        setReceivedAmount(String(c + u + b));
                      }}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="bankAmount">Bank Amount (₹)</label>
                    <input
                      id="bankAmount"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={bankAmount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBankAmount(val);
                        const c = Number(cashAmount || 0);
                        const u = Number(upiAmount || 0);
                        const b = Number(val || 0);
                        setReceivedAmount(String(c + u + b));
                      }}
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="creditAmount">Credit / Due Amount (₹)</label>
                    <input
                      id="creditAmount"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  {(() => {
                    const splitSum =
                      (Number(cashAmount) || 0) +
                      (Number(upiAmount) || 0) +
                      (Number(bankAmount) || 0) +
                      (Number(creditAmount) || 0);
                    const diff = totalAmount - splitSum;
                    return (
                      <>
                        <span
                          className={
                            Math.abs(diff) < 0.01
                              ? "text-emerald-700 font-semibold"
                              : "text-red-700 font-semibold"
                          }
                        >
                          Split Sum: ₹{splitSum.toLocaleString("en-IN")} / ₹{totalAmount.toLocaleString("en-IN")}
                          {Math.abs(diff) >= 0.01 && ` (Difference: ₹${diff.toLocaleString("en-IN")})`}
                        </span>
                        <button
                          type="button"
                          onClick={() => autoBalanceSaleSplit(totalAmount)}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          Auto-balance remaining to Credit
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Totals Summary */}
            <div className="mt-5 pt-4 border-t border-gray-100 flex justify-end">
              <div className="purchase-total" style={{ width: "100%", maxWidth: "24rem" }}>
                <div className="purchase-total-row">
                  <span>Total Sale Amount</span>
                  <span>₹{totalAmount.toLocaleString("en-IN")}</span>
                </div>
                <div className="purchase-total-row" style={{ color: "#16a34a", fontSize: "0.95rem" }}>
                  <span>Amount Received</span>
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
                  <span>Balance Due (Credit)</span>
                  <span>₹{Math.max(0, totalAmount - (Number(receivedAmount) || 0)).toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>
          </div>

          {error && <p className="text-error mb-4">{error}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => router.push("/dashboard/sales")}
              className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving..." : "Save Sale"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
