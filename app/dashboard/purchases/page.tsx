"use client";

import { useEffect, useState, Suspense } from "react";
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
  removePurchaseLotQuantity,
  totalStock,
  type StockLot,
} from "@/lib/stockLots";
import {
  formatDisplayDate,
  matchesDateRange,
  extractTransactionDate,
} from "@/lib/dateUtils";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/ToastContext";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  ShoppingBag,
  Plus,
  Search,
  Calendar,
  RotateCcw,
  Eye,
  Edit2,
  Trash2,
  FileText,
} from "lucide-react";

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

function PurchasesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [fromDate, setFromDate] = useState(() => searchParams.get("fromDate") || "");
  const [toDate, setToDate] = useState(() => searchParams.get("toDate") || "");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">(
    () => (searchParams.get("sortBy") as "newest" | "oldest") || "newest"
  );

  const updateUrlParams = (params: {
    search?: string;
    fromDate?: string;
    toDate?: string;
    sortBy?: "newest" | "oldest";
  }) => {
    if (typeof window === "undefined") return;
    const current = new URLSearchParams(window.location.search);
    current.delete("returnTo");
    if (params.search && params.search.trim()) current.set("search", params.search.trim());
    else current.delete("search");
    if (params.fromDate) current.set("fromDate", params.fromDate);
    else current.delete("fromDate");
    if (params.toDate) current.set("toDate", params.toDate);
    else current.delete("toDate");
    if (params.sortBy && params.sortBy !== "newest") current.set("sortBy", params.sortBy);
    else current.delete("sortBy");
    const qs = current.toString();
    const newUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    window.history.replaceState(null, "", newUrl);
  };

  const getReturnToUrl = () => {
    if (typeof window !== "undefined") {
      return window.location.pathname + window.location.search;
    }
    return "/dashboard/purchases";
  };

  // Deletion modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState<Purchase | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openDeleteModal = (purchase: Purchase) => {
    setPurchaseToDelete(purchase);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!purchaseToDelete) return;
    const id = purchaseToDelete.id;

    setDeleting(true);
    try {
      await runTransaction(db, async (transaction) => {
        const purchaseRef = doc(db, "purchases", id);
        const purchaseSnap = await transaction.get(purchaseRef);
        if (!purchaseSnap.exists()) throw new Error("Purchase not found.");

        const purchaseData = purchaseSnap.data() as Purchase;
        type RawItem = {
          productId?: string;
          quantity?: number;
          purchasePrice?: number;
          purchasedAt?: string;
          lotNumber?: string;
          lotId?: string;
        };
        const rawItems = (purchaseData.items || []) as RawItem[];

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
            ...(snaps[pid].data() as {
              stock?: number;
              purchasePrice?: number;
              stockLots?: StockLot[];
            }),
          });
        }

        for (const rawItem of rawItems) {
          const pid = rawItem.productId;
          if (!pid) continue;
          const qty = Number(rawItem.quantity) || 0;
          const productName = (snaps[pid].data() as { name?: string }).name ?? pid;

          const itemMeta = {
            lotId: rawItem.lotId,
            quantity: qty,
            purchasePrice: rawItem.purchasePrice !== undefined ? Number(rawItem.purchasePrice) : undefined,
            purchasedAt: rawItem.purchasedAt || purchaseData.purchaseDate,
            lotNumber: rawItem.lotNumber,
          };

          checkPurchaseCanBeReversed(lotsMap[pid], itemMeta, qty, productName);
          lotsMap[pid] = removePurchaseLotQuantity(lotsMap[pid], itemMeta, qty);
        }

        for (const pid of productIds) {
          transaction.update(doc(db, "products", pid), {
            stockLots: lotsMap[pid],
            stock: totalStock(lotsMap[pid]),
          });
        }

        transaction.delete(purchaseRef);
      });

      setPurchases((prev) => prev.filter((p) => p.id !== id));
      showToast("Purchase deleted and inventory reversed successfully", "success");
      setDeleteModalOpen(false);
    } catch (error) {
      console.error("Error deleting purchase:", error);
      showToast(
        error instanceof Error ? error.message : "Could not delete purchase.",
        "error"
      );
    } finally {
      setDeleting(false);
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
        showToast("Failed to load purchases", "error");
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
      return (
        dateB.localeCompare(dateA) ||
        Number(b.purchaseNumber || 0) - Number(a.purchaseNumber || 0) ||
        String(b.id).localeCompare(String(a.id))
      );
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Purchase Invoices</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Log inward shipments, multi-item supplier invoices, and stock lots.
          </p>
        </div>

        <Link
          href="/dashboard/purchases/add"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Purchase</span>
        </Link>
      </div>

      {/* Filter and Search Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Search Invoices
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Supplier, invoice, product..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  updateUrlParams({ search: e.target.value, fromDate, toDate, sortBy });
                }}
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
              onChange={(e) => {
                setFromDate(e.target.value);
                updateUrlParams({ search, fromDate: e.target.value, toDate, sortBy });
              }}
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
              onChange={(e) => {
                setToDate(e.target.value);
                updateUrlParams({ search, fromDate, toDate: e.target.value, sortBy });
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Sort by Date
            </label>
            <select
              value={sortBy}
              onChange={(e) => {
                const val = e.target.value as "newest" | "oldest";
                setSortBy(val);
                updateUrlParams({ search, fromDate, toDate, sortBy: val });
              }}
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
                updateUrlParams({ search: "", fromDate: "", toDate: "", sortBy });
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
            Loading purchases...
          </p>
        </div>
      ) : filteredPurchases.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-3">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No purchases found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {search || fromDate || toDate
              ? "No purchase invoices matched the specified filters."
              : "Start by recording your first inward supplier purchase invoice."}
          </p>
          <Link
            href="/dashboard/purchases/add"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Purchase</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mobile Card Feed (block md:hidden) */}
          <div className="block md:hidden space-y-3">
            {filteredPurchases.map((p) => {
              const productNames =
                (p.items || [])
                  .map((i) => i.productName)
                  .filter(Boolean)
                  .join(", ") || "—";
              const itemCount = (p.items || []).length;

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/purchases/${p.id}?returnTo=${encodeURIComponent(getReturnToUrl())}`}
                        className="font-mono text-sm font-bold text-purple-700 hover:underline block truncate"
                      >
                        {p.supplierInvoice || `#${p.purchaseNumber}`}
                      </Link>
                      <div className="text-xs font-semibold text-slate-900 mt-0.5 truncate">
                        {p.supplierName}
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                      {formatDisplayDate(p.purchaseDate)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Invoice</span>
                      <span className="font-bold text-slate-900 text-sm">
                        ₹{p.totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Payment / Items</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-200 text-slate-700">
                          {p.paymentMethod || "Cash"}
                        </span>
                        <span className="text-[11px] text-slate-600 font-medium">
                          {itemCount} {itemCount === 1 ? "Item" : "Items"}
                        </span>
                      </div>
                    </div>
                    {productNames !== "—" && (
                      <div className="col-span-2 pt-1.5 border-t border-slate-200/60 text-[11px] text-slate-500 truncate" title={productNames}>
                        <span className="text-slate-400">Products: </span>
                        <span>{productNames}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <Link
                      href={`/dashboard/purchases/${p.id}?returnTo=${encodeURIComponent(getReturnToUrl())}`}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition inline-flex items-center justify-center gap-1.5 min-h-[44px]"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => router.push(`/dashboard/purchases/edit/${p.id}?returnTo=${encodeURIComponent(getReturnToUrl())}`)}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-800 font-semibold text-xs transition inline-flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteModal(p)}
                      className="py-2.5 px-3.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold text-xs transition inline-flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
                      title="Delete Purchase"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table (hidden md:block) */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-center">Payment</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPurchases.map((p) => {
                  const productNames =
                    (p.items || [])
                      .map((i) => i.productName)
                      .filter(Boolean)
                      .join(", ") || "—";
                  const itemCount = (p.items || []).length;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap font-medium">
                        {formatDisplayDate(p.purchaseDate)}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <Link
                          href={`/dashboard/purchases/${p.id}?returnTo=${encodeURIComponent(getReturnToUrl())}`}
                          className="font-mono text-xs font-bold text-purple-700 hover:underline"
                        >
                          {p.supplierInvoice || `#${p.purchaseNumber}`}
                        </Link>
                      </td>

                      <td className="py-3 px-4 text-slate-900 font-semibold">
                        {p.supplierName}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {itemCount} {itemCount === 1 ? "Item" : "Items"}
                        </span>
                        {productNames !== "—" && (
                          <div
                            className="text-[10px] text-slate-400 truncate max-w-[200px] mx-auto mt-0.5"
                            title={productNames}
                          >
                            {productNames}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                        ₹{p.totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {p.paymentMethod || "Cash"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/dashboard/purchases/${p.id}?returnTo=${encodeURIComponent(getReturnToUrl())}`}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                            title="View Purchase"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/purchases/edit/${p.id}?returnTo=${encodeURIComponent(getReturnToUrl())}`)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="Edit Purchase"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => openDeleteModal(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Delete Purchase"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )}

      {/* Accessible Confirm Modal for Purchase Deletion */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Purchase Invoice"
        message={`Are you sure you want to delete purchase #${purchaseToDelete?.supplierInvoice || purchaseToDelete?.purchaseNumber}? Stock quantities allocated by this invoice will be reversed if not already sold.`}
        confirmText="Reverse & Delete"
        cancelText="Cancel"
        isDanger={true}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalOpen(false)}
      />
    </div>
  );
}

export default function PurchasesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Loading purchases...</div>}>
      <PurchasesContent />
    </Suspense>
  );
}