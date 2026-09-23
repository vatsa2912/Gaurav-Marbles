"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  runTransaction,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  checkPurchaseCanBeReversed,
  normaliseLots,
  removeLotQuantity,
  totalStock,
  type StockLot,
} from "@/lib/stockLots";
import {
  formatDisplayDate,
  matchesDateRange,
  extractTransactionDate,
} from "@/lib/dateUtils";
import { useRouter } from "next/navigation";

type PurchaseItem = {
  productId?: string;
  productName: string;
  quantity: number;
  unit?: string;
  purchasePrice: number;
  sellingPrice?: number;
  total?: number;
  lotId?: string;
};

type Purchase = {
  id: string;
  purchaseNumber: number | string;
  purchaseDate: string;
  supplierInvoice?: string;
  supplierName: string;
  items: PurchaseItem[];
  totalAmount: number;
  paymentMethod?: string;
  status?: string;
  createdAt?: unknown;
};

export default function PurchasesPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this purchase? Stock will be reversed."
    );
    if (!confirmed) return;

    try {
      await runTransaction(db, async (transaction) => {
        const purchaseRef = doc(db, "purchases", id);
        const purchaseSnap = await transaction.get(purchaseRef);
        if (!purchaseSnap.exists()) throw new Error("Purchase not found.");

        type RawItem = { productId?: string; quantity?: number; lotId?: string };
        const rawItems = (purchaseSnap.data().items || []) as RawItem[];

        const productIds = Array.from(
          new Set(rawItems.map((i) => i.productId).filter(Boolean) as string[])
        );

        const snaps: Record<string, Awaited<ReturnType<typeof transaction.get>>> = {};
        for (const pid of productIds) {
          const snap = await transaction.get(doc(db, "products", pid));
          if (!snap.exists()) throw new Error(`Product no longer exists (id: ${pid}).`);
          snaps[pid] = snap;
        }

        const lotsMap: Record<string, StockLot[]> = {};
        for (const pid of productIds) {
          lotsMap[pid] = normaliseLots({
            id: pid,
            ...(snaps[pid].data() as { stock?: number; purchasePrice?: number; stockLots?: StockLot[] }),
          });
        }

        for (const rawItem of rawItems) {
          const pid = rawItem.productId;
          if (!pid) continue;
          const qty = Number(rawItem.quantity) || 0;
          const productName = (snaps[pid].data() as { name?: string }).name ?? pid;

          if (rawItem.lotId) {
            checkPurchaseCanBeReversed(lotsMap[pid], rawItem.lotId, qty, productName);
            lotsMap[pid] = removeLotQuantity(lotsMap[pid], rawItem.lotId, qty);
          } else {
            // Legacy purchase without lotId: check if total stock is sufficient
            const currentStock = totalStock(lotsMap[pid]);
            if (currentStock < qty) {
              const sold = qty - currentStock;
              throw new Error(
                `Cannot delete purchase for "${productName}": ${sold} unit(s) have already been sold in customer sales.`
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

        // Apply updated lots and stock to all products
        for (const pid of productIds) {
          transaction.update(doc(db, "products", pid), {
            stockLots: lotsMap[pid],
            stock: totalStock(lotsMap[pid]),
          });
        }

        // Delete the purchase record
        transaction.delete(purchaseRef);
      });

      setPurchases((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error("Error deleting purchase:", error);
      alert(error instanceof Error ? error.message : "Could not delete purchase.");
    }
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const snapshot = await getDocs(collection(db, "purchases"));
        const list = snapshot.docs.map((d) => {
          const data = d.data();
          const effectiveDate = extractTransactionDate(data, "purchaseDate");
          return {
            id: d.id,
            purchaseNumber: data.purchaseNumber ?? d.id,
            purchaseDate: effectiveDate,
            supplierInvoice: data.supplierInvoice || "",
            supplierName: data.supplierName || "—",
            items: data.items || [],
            totalAmount: Number(data.totalAmount) || 0,
            paymentMethod: data.paymentMethod || "—",
            status: data.status || "—",
            createdAt: data.createdAt,
          } as Purchase;
        });

        if (isMounted) {
          setPurchases(list);
        }
      } catch (err) {
        console.error("Error loading purchases:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredPurchases = purchases
    .filter((purchase) => {
      const searchText = search.toLowerCase().trim();

      const itemNames = (purchase.items || [])
        .map((i) => (i.productName || "").toLowerCase())
        .join(" ");

      const matchesSearch =
        !searchText ||
        purchase.supplierName.toLowerCase().includes(searchText) ||
        String(purchase.purchaseNumber).includes(searchText) ||
        (purchase.supplierInvoice || "").toLowerCase().includes(searchText) ||
        itemNames.includes(searchText);

      const matchesDate = matchesDateRange(purchase.purchaseDate, fromDate, toDate);

      return matchesSearch && matchesDate;
    })
    .sort((a, b) => {
      const dateA = (a.purchaseDate || "").trim();
      const dateB = (b.purchaseDate || "").trim();
      if (sortBy === "oldest") {
        return (
          dateA.localeCompare(dateB) ||
          Number(a.purchaseNumber || 0) - Number(b.purchaseNumber || 0) ||
          String(a.id).localeCompare(String(b.id))
        );
      }
      // Newest First:
      return (
        dateB.localeCompare(dateA) ||
        Number(b.purchaseNumber || 0) - Number(a.purchaseNumber || 0) ||
        String(b.id).localeCompare(String(a.id))
      );
    });

  return (
    <main className="page-main">
      <header className="site-header">
        <h1 className="text-xl">Gaurav Marbles</h1>
        <p className="text-muted">Purchase Management</p>
      </header>

      <div className="page-content">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Purchases</h2>
            <p className="text-muted text-xs mt-1">Record and track inventory purchase invoices</p>
          </div>
          <button
            onClick={() => router.push("/dashboard/purchases/add")}
            className="btn-primary"
          >
            + New Purchase
          </button>
        </div>

        {/* Filter & Sort Controls */}
        <div className="card mb-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div className="form-field">
              <label>Search Purchases</label>
              <input
                type="text"
                placeholder="Supplier, invoice #, product..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>Sort by Date</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>

          {(search || fromDate || toDate) && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setFromDate("");
                  setToDate("");
                }}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="rounded-xl bg-white p-8 text-center text-muted">
            Loading purchases...
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="rounded-xl bg-white p-10 text-center border border-gray-200">
            <div className="text-5xl">🧾</div>
            <h3 className="mt-4 text-lg font-bold">No purchases found</h3>
            <p className="text-muted text-xs mt-1">
              Start by recording your first purchase transaction.
            </p>
            <button
              onClick={() => router.push("/dashboard/purchases/add")}
              className="btn-primary mt-4"
            >
              + New Purchase
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="text-left font-semibold">Date</th>
                  <th className="text-left font-semibold">Invoice</th>
                  <th className="text-left font-semibold">Supplier</th>
                  <th className="text-center font-semibold">Items</th>
                  <th className="text-right font-semibold">Total</th>
                  <th className="text-center font-semibold">Payment</th>
                  <th className="text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.map((p) => {
                  const productNames = (p.items || [])
                    .map((i) => i.productName)
                    .filter(Boolean)
                    .join(", ") || "—";

                  const itemCount = (p.items || []).length;

                  return (
                    <tr key={p.id}>
                      <td className="font-semibold text-gray-900 whitespace-nowrap">
                        {formatDisplayDate(p.purchaseDate)}
                      </td>
                      <td className="font-mono text-xs font-bold text-blue-700 whitespace-nowrap">
                        {p.supplierInvoice || `#${p.purchaseNumber}`}
                      </td>
                      <td className="text-gray-800 font-medium">
                        {p.supplierName}
                      </td>
                      <td className="text-center whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {itemCount} {itemCount === 1 ? "Item" : "Items"}
                        </span>
                        {productNames !== "—" && (
                          <div
                            className="text-[11px] text-gray-500 truncate max-w-[200px] mx-auto mt-0.5"
                            title={productNames}
                          >
                            {productNames}
                          </div>
                        )}
                      </td>
                      <td className="text-right font-bold text-gray-900 whitespace-nowrap">
                        ₹{p.totalAmount.toLocaleString("en-IN")}
                      </td>
                      <td className="text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800">
                          {p.paymentMethod || "Cash"}
                        </span>
                      </td>
                      <td className="text-center whitespace-nowrap">
                        <div className="flex justify-center gap-3">
                          <button
                            onClick={() => router.push(`/dashboard/purchases/${p.id}`)}
                            className="text-xs font-medium text-blue-600 hover:underline"
                          >
                            View
                          </button>
                          <button
                            onClick={() => router.push(`/dashboard/purchases/edit/${p.id}`)}
                            className="text-xs font-medium text-blue-600 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="text-xs font-medium text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}