"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  doc,
  getDoc,
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
import { formatDisplayDate } from "@/lib/dateUtils";
import { useToast } from "@/components/ui/ToastContext";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  ArrowLeft,
  Edit2,
  Trash2,
  ShoppingBag,
  Building2,
  FileText,
  Calendar,
  ExternalLink,
} from "lucide-react";

type PurchaseItem = {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  purchasePrice: number;
  sellingPrice?: number;
  total: number;
};

type Purchase = {
  purchaseNumber: number;
  purchaseDate: string;
  supplierName: string;
  supplierInvoice?: string;
  items: PurchaseItem[];
  totalAmount: number;
  paymentMethod?: string;
};

export default function PurchaseDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();

  const purchaseId = params.id as string;

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadPurchase = async () => {
      try {
        if (!purchaseId) return;
        const purchaseRef = doc(db, "purchases", purchaseId);
        const purchaseSnapshot = await getDoc(purchaseRef);

        if (purchaseSnapshot.exists()) {
          const rawData = purchaseSnapshot.data();
          let items: PurchaseItem[] = [];

          if (Array.isArray(rawData.items) && rawData.items.length > 0) {
            items = rawData.items.map((it: Partial<PurchaseItem>) => ({
              productId: it.productId || "",
              productName: it.productName || "Product",
              quantity: Number(it.quantity) || 0,
              unit: it.unit || "unit",
              purchasePrice: Number(it.purchasePrice) || 0,
              sellingPrice:
                it.sellingPrice !== undefined && it.sellingPrice !== null
                  ? Number(it.sellingPrice)
                  : undefined,
              total: Number(it.total) || Number(it.quantity) * Number(it.purchasePrice) || 0,
            }));
          } else if (rawData.productName || rawData.productId) {
            items = [
              {
                productId: rawData.productId || "",
                productName: rawData.productName || "Product",
                quantity: Number(rawData.quantity) || 0,
                unit: rawData.unit || "unit",
                purchasePrice: Number(rawData.purchasePrice) || 0,
                sellingPrice:
                  rawData.sellingPrice !== undefined && rawData.sellingPrice !== null
                    ? Number(rawData.sellingPrice)
                    : undefined,
                total:
                  Number(rawData.totalAmount) ||
                  (Number(rawData.quantity) || 0) * (Number(rawData.purchasePrice) || 0),
              },
            ];
          }

          if (isMounted) {
            setPurchase({ ...rawData, items } as Purchase);
          }
        }
      } catch (error) {
        console.error("Error loading purchase:", error);
        showToast("Error loading purchase", "error");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPurchase();
    return () => {
      isMounted = false;
    };
  }, [purchaseId, showToast]);

  const handleConfirmDelete = async () => {
    if (!purchaseId) return;

    try {
      setDeleting(true);

      await runTransaction(db, async (transaction) => {
        const purchaseRef = doc(db, "purchases", purchaseId);
        const purchaseSnapshot = await transaction.get(purchaseRef);

        if (!purchaseSnapshot.exists()) throw new Error("Purchase not found.");

        const purchaseData = purchaseSnapshot.data() as Purchase;

        type PurchaseItemRaw = {
          productId?: string;
          quantity?: number;
          lotId?: string;
        };
        const rawItems = (purchaseData.items || []) as PurchaseItemRaw[];

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

          if (rawItem.lotId) {
            checkPurchaseCanBeReversed(lotsMap[pid], rawItem.lotId, qty, productName);
            lotsMap[pid] = removeLotQuantity(lotsMap[pid], rawItem.lotId, qty);
          } else {
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

        for (const pid of productIds) {
          transaction.update(doc(db, "products", pid), {
            stockLots: lotsMap[pid],
            stock: totalStock(lotsMap[pid]),
          });
        }

        transaction.delete(purchaseRef);
      });

      showToast("Purchase deleted and stock reversed successfully", "success");
      router.push("/dashboard/purchases");
    } catch (error) {
      console.error("Error deleting purchase:", error);
      showToast(error instanceof Error ? error.message : "Could not delete purchase.", "error");
    } finally {
      setDeleting(false);
      setDeleteModalOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Loading purchase details...
        </p>
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Purchase Not Found</h2>
        <p className="text-xs text-slate-500">This purchase record does not exist or has been removed.</p>
        <Link
          href="/dashboard/purchases"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Purchases</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <Link
            href="/dashboard/purchases"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Purchases</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Purchase #{purchase.purchaseNumber}
            </h1>
            {purchase.supplierInvoice && (
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                {purchase.supplierInvoice}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Inward Shipment Date: {formatDisplayDate(purchase.purchaseDate)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push(`/dashboard/purchases/edit/${purchaseId}`)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition shadow-xs cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Purchase</span>
          </button>

          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Purchase</span>
          </button>
        </div>
      </div>

      {/* Invoice Meta Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Supplier Info */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Supplier
          </span>
          <div className="mt-2 text-base font-bold text-slate-900 truncate">
            {purchase.supplierName}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
            <Link
              href={`/dashboard/accounts/supplier-ledger?party=${encodeURIComponent(purchase.supplierName)}`}
              className="text-xs font-semibold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1"
            >
              <span>Supplier Ledger</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Invoice Number */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Invoice Number
          </span>
          <div className="mt-2 text-base font-mono font-bold text-slate-900">
            {purchase.supplierInvoice || `#${purchase.purchaseNumber}`}
          </div>
          <p className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100">
            Recorded in purchases collection
          </p>
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Payment Method
          </span>
          <div className="mt-2 text-base font-bold text-slate-900">
            {purchase.paymentMethod || "Cash"}
          </div>
          <p className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100">
            Settlement terms
          </p>
        </div>

        {/* Total Invoice Amount */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Invoice Amount
          </span>
          <div className="mt-2 text-2xl font-bold text-purple-700">
            ₹{purchase.totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100">
            {purchase.items.length} item{purchase.items.length === 1 ? "" : "s"} total
          </p>
        </div>
      </div>

      {/* Items Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200/80 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Purchase Items Breakdown ({purchase.items.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Quantities and lot replenishment prices in this invoice
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4 text-right">Purchase Price</th>
                <th className="py-3 px-4 text-right">Selling Price</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchase.items.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>

                  <td className="py-3 px-4 font-bold text-slate-900">
                    {item.productId ? (
                      <Link
                        href={`/dashboard/products/${item.productId}`}
                        className="hover:text-blue-600 hover:underline"
                      >
                        {item.productName}
                      </Link>
                    ) : (
                      item.productName
                    )}
                  </td>

                  <td className="py-3 px-4 text-right font-bold text-slate-800">
                    {item.quantity.toLocaleString("en-IN")}{" "}
                    <span className="font-normal text-slate-500 text-[11px]">{item.unit}</span>
                  </td>

                  <td className="py-3 px-4 text-right text-slate-700">
                    ₹{item.purchasePrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </td>

                  <td className="py-3 px-4 text-right font-medium text-emerald-700">
                    {item.sellingPrice !== undefined
                      ? `₹${item.sellingPrice.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                      : "—"}
                  </td>

                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                    ₹{item.total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-bold border-t-2 border-slate-200 text-slate-900">
                <td colSpan={5} className="py-3 px-4 text-right">Total Invoice Sum</td>
                <td className="py-3 px-4 text-right text-purple-700 text-sm">
                  ₹{purchase.totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Accessible Confirm Modal for Purchase Deletion */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Purchase Invoice"
        message={`Are you sure you want to delete purchase #${purchase.supplierInvoice || purchase.purchaseNumber}? Stock quantities allocated by this invoice will be reversed if not already sold.`}
        confirmText="Reverse Stock & Delete"
        cancelText="Cancel"
        isDanger={true}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalOpen(false)}
      />
    </div>
  );
}