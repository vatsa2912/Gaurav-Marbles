"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  formatDisplayDate,
  matchesDateRange,
  extractTransactionDate,
} from "@/lib/dateUtils";
import { useToast } from "@/components/ui/ToastContext";
import {
  ShoppingCart,
  Plus,
  Search,
  RotateCcw,
  Eye,
  Calendar,
} from "lucide-react";

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
  const { showToast } = useToast();

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
        showToast("Failed to load sales", "error");
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
  }, [showToast]);

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
      return (
        dateB.localeCompare(dateA) ||
        Number(b.saleNumber || 0) - Number(a.saleNumber || 0) ||
        String(b.id).localeCompare(String(a.id))
      );
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sales Transactions</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Dispatch orders, customer tax invoices, and payment tracking.
          </p>
        </div>

        <Link
          href="/dashboard/sales/add"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Sale</span>
        </Link>
      </div>

      {/* Filter and Search Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Search Sales
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Customer, product, sale #..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-slate-50/50 hover:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Sort by Date
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>

        {(search || fromDate || toDate) && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setFromDate("");
                setToDate("");
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Table Section */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Loading sales transactions...
          </p>
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No sales transactions found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {search || fromDate || toDate
              ? "No customer sales matched your active filters."
              : "Start by creating your first sales bill / dispatch note."}
          </p>
          <Link
            href="/dashboard/sales/add"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Sale</span>
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Sale #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Product(s)</th>
                  <th className="py-3 px-4 text-right">Quantity</th>
                  <th className="py-3 px-4 text-right">Selling Price</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-center">Payment</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((s) => {
                  const productNames = (s.items || [])
                    .map((i) => i.productName)
                    .filter(Boolean)
                    .join(", ") || "—";

                  const quantities = (s.items || [])
                    .map((i) =>
                      `${Number(i.quantity).toLocaleString("en-IN")} ${i.unit || ""}`.trim()
                    )
                    .join(", ") || "—";

                  const sellingPrices = (s.items || [])
                    .map((i) => {
                      const rate =
                        i.sellingPrice ??
                        i.rate ??
                        (i.quantity > 0 ? i.total / i.quantity : 0);
                      return `₹${Number(rate).toLocaleString("en-IN")}`;
                    })
                    .join(", ") || "—";

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap font-medium">
                        {formatDisplayDate(s.saleDate)}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <Link
                          href={`/dashboard/sales/${s.id}`}
                          className="font-mono text-xs font-bold text-blue-600 hover:underline"
                        >
                          #{s.saleNumber}
                        </Link>
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {s.customerName}
                      </td>

                      <td className="py-3 px-4 text-slate-800 font-medium max-w-[200px] truncate" title={productNames}>
                        {productNames}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                        {quantities}
                      </td>

                      <td className="py-3 px-4 text-right text-emerald-700 font-medium whitespace-nowrap">
                        {sellingPrices}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                        ₹{s.totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {s.paymentMethod || "Cash"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <Link
                          href={`/dashboard/sales/${s.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-[11px] transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}