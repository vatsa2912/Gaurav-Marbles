"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import {
  formatDisplayDate,
  matchesDateRange,
  extractTransactionDate,
} from "@/lib/dateUtils";

type SaleItem = {
  productId?: string;
  productName: string;
  quantity: number;
  unit?: string;
  sellingPrice?: number;
  rate?: number;
  total: number;
  costPrice?: number;
  costTotal?: number;
};

type Sale = {
  id: string;
  saleNumber: number | string;
  saleDate: string;
  dueDate?: string;
  customerName: string;
  items: SaleItem[];
  totalAmount: number;
  receivedAmount?: number;
  paidAmount?: number;
  paymentMethod?: string;
  createdAt?: unknown;
};

export default function SalesPage() {
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const snapshot = await getDocs(collection(db, "sales"));

        const list = snapshot.docs.map((d) => {
          const data = d.data();
          const effectiveDate = extractTransactionDate(data, "saleDate");
          return {
            id: d.id,
            saleNumber: data.saleNumber ?? d.id,
            saleDate: effectiveDate,
            dueDate: data.dueDate,
            customerName: data.customerName || "Walk-in Customer",
            items: data.items || [],
            totalAmount: Number(data.totalAmount) || 0,
            receivedAmount: Number(data.receivedAmount ?? data.paidAmount ?? 0),
            paidAmount: Number(data.paidAmount ?? data.receivedAmount ?? 0),
            paymentMethod: data.paymentMethod || "Cash",
            createdAt: data.createdAt,
          } as Sale;
        });

        if (isMounted) {
          setSales(list);
        }
      } catch (err) {
        console.error("Error loading sales:", err);
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

  const filteredSales = sales
    .filter((sale) => {
      const searchText = search.toLowerCase().trim();

      const itemNames = (sale.items || [])
        .map((i) => (i.productName || "").toLowerCase())
        .join(" ");

      const matchesSearch =
        !searchText ||
        sale.customerName.toLowerCase().includes(searchText) ||
        String(sale.saleNumber).includes(searchText) ||
        itemNames.includes(searchText);

      const matchesDate = matchesDateRange(sale.saleDate, fromDate, toDate);

      return matchesSearch && matchesDate;
    })
    .sort((a, b) => {
      const dateA = (a.saleDate || "").trim();
      const dateB = (b.saleDate || "").trim();
      if (sortBy === "oldest") {
        return (
          dateA.localeCompare(dateB) ||
          Number(a.saleNumber || 0) - Number(b.saleNumber || 0) ||
          String(a.id).localeCompare(String(b.id))
        );
      }
      // Newest First:
      return (
        dateB.localeCompare(dateA) ||
        Number(b.saleNumber || 0) - Number(a.saleNumber || 0) ||
        String(b.id).localeCompare(String(a.id))
      );
    });

  return (
    <main className="page-main">
      <header className="site-header">
        <h1 className="text-xl">Gaurav Marbles</h1>
        <p className="text-muted">Sales Management</p>
      </header>

      <div className="page-content">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Sales</h2>
            <p className="text-muted text-xs mt-1">Track customer bills and transactions by date</p>
          </div>
          <button
            onClick={() => router.push("/dashboard/sales/add")}
            className="btn-primary"
          >
            + New Sale
          </button>
        </div>

        {/* Filter & Sort Controls */}
        <div className="card mb-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div className="form-field">
              <label>Search Sales</label>
              <input
                type="text"
                placeholder="Customer, product, or #..."
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
            Loading sales...
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="rounded-xl bg-white p-10 text-center border border-gray-200">
            <div className="text-5xl">🏷️</div>
            <h3 className="mt-4 text-lg font-bold">No sales found</h3>
            <p className="text-muted text-xs mt-1">
              Start by creating your first sales invoice.
            </p>
            <button
              onClick={() => router.push("/dashboard/sales/add")}
              className="btn-primary mt-4"
            >
              + New Sale
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="text-left font-semibold">Date</th>
                  <th className="text-left font-semibold">Invoice</th>
                  <th className="text-left font-semibold">Customer</th>
                  <th className="text-left font-semibold">Product</th>
                  <th className="text-right font-semibold">Quantity</th>
                  <th className="text-right font-semibold">Selling Price</th>
                  <th className="text-right font-semibold">Total</th>
                  <th className="text-center font-semibold">Payment Method</th>
                  <th className="text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((s) => {
                  const productNames = (s.items || [])
                    .map((i) => i.productName)
                    .filter(Boolean)
                    .join(", ") || "—";

                  const quantities = (s.items || [])
                    .map((i) => `${Number(i.quantity).toLocaleString("en-IN")} ${i.unit || ""}`.trim())
                    .join(", ") || "—";

                  const sellingPrices = (s.items || [])
                    .map((i) => {
                      const rate = i.sellingPrice ?? i.rate ?? (i.quantity > 0 ? i.total / i.quantity : 0);
                      return `₹${Number(rate).toLocaleString("en-IN")}`;
                    })
                    .join(", ") || "—";

                  return (
                    <tr key={s.id}>
                      <td className="font-semibold text-gray-900 whitespace-nowrap">
                        {formatDisplayDate(s.saleDate)}
                      </td>
                      <td className="font-medium text-blue-600 whitespace-nowrap">
                        #{s.saleNumber}
                      </td>
                      <td className="font-medium text-gray-800">
                        {s.customerName}
                      </td>
                      <td className="font-medium text-gray-900">
                        {productNames}
                      </td>
                      <td className="text-right font-bold text-gray-900 whitespace-nowrap">
                        {quantities}
                      </td>
                      <td className="text-right whitespace-nowrap text-emerald-700 font-medium">
                        {sellingPrices}
                      </td>
                      <td className="text-right font-bold text-gray-900 whitespace-nowrap">
                        ₹{s.totalAmount.toLocaleString("en-IN")}
                      </td>
                      <td className="text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800">
                          {s.paymentMethod || "Cash"}
                        </span>
                      </td>
                      <td className="text-center whitespace-nowrap">
                        <button
                          onClick={() => router.push(`/dashboard/sales/${s.id}`)}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          View
                        </button>
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