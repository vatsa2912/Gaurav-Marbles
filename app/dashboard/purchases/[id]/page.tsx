"use client";

import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  runTransaction,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  checkPurchaseCanBeReversed,
  normaliseLots,
  removeLotQuantity,
  totalStock,
  type StockLot,
} from "@/lib/stockLots";
import { formatDisplayDate } from "@/lib/dateUtils";

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

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadPurchase = async () => {
      try {
        const id = params?.id as string;
        if (!id) {
          if (isMounted) setLoading(false);
          return;
        }

        const snapshot = await getDoc(
          doc(db, "purchases", id)
        );

        if (isMounted) {
          if (snapshot.exists()) {
            const rawData = snapshot.data();
            let items = rawData.items || [];
            if ((!items || items.length === 0) && rawData.productName) {
              items = [
                {
                  productId: rawData.productId || "",
                  productName: rawData.productName || "Unknown Product",
                  quantity: Number(rawData.quantity) || 0,
                  unit: rawData.unit || "unit",
                  purchasePrice: Number(rawData.purchasePrice) || 0,
                  sellingPrice: rawData.sellingPrice,
                  total: Number(rawData.totalAmount || rawData.total) || 0,
                },
              ];
            }
            setPurchase({ ...rawData, items } as Purchase);
          }
        }
      } catch (error) {
        console.error("Error loading purchase:", error);
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
  }, [params.id]);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this purchase? Stock will be reversed."
    );
    if (!confirmed) return;

    try {
      setDeleting(true);
      const purchaseId = params.id as string;

      await runTransaction(db, async (transaction) => {
        const purchaseRef = doc(db, "purchases", purchaseId);
        const purchaseSnapshot = await transaction.get(purchaseRef);

        if (!purchaseSnapshot.exists()) throw new Error("Purchase not found.");

        const purchaseData = purchaseSnapshot.data() as Purchase;

        // Aggregate items: group by productId so we know which lots to reverse
        type PurchaseItemRaw = {
          productId?: string;
          quantity?: number;
          lotId?: string;
        };
        const rawItems = (purchaseData.items || []) as PurchaseItemRaw[];

        // Unique product IDs (skip empty)
        const productIds = Array.from(
          new Set(rawItems.map((i) => i.productId).filter(Boolean) as string[])
        );

        // Read all affected products
        const snaps: Record<string, Awaited<ReturnType<typeof transaction.get>>> = {};
        for (const pid of productIds) {
          const snap = await transaction.get(doc(db, "products", pid));
          if (!snap.exists()) throw new Error(`Product no longer exists (id: ${pid}).`);
          snaps[pid] = snap;
        }

        // Build working lots per product
        const lotsMap: Record<string, StockLot[]> = {};
        for (const pid of productIds) {
          lotsMap[pid] = normaliseLots({
            id: pid,
            ...(snaps[pid].data() as { stock?: number; purchasePrice?: number; stockLots?: StockLot[] }),
          });
        }

        // Reverse each item from its lot
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

        // Validate no negative stock
        for (const pid of productIds) {
          const ts = totalStock(lotsMap[pid]);
          if (ts < 0) {
            const name = (snaps[pid].data() as { name?: string }).name ?? pid;
            throw new Error(
              `Cannot delete: stock of "${name}" would go negative. Some stock may have already been sold.`
            );
          }
        }

        // Update products
        for (const pid of productIds) {
          transaction.update(doc(db, "products", pid), {
            stockLots: lotsMap[pid],
            stock: totalStock(lotsMap[pid]),
          });
        }

        // Delete the purchase
        transaction.delete(purchaseRef);
      });

      router.push("/dashboard/purchases");
    } catch (error) {
      console.error("Error deleting purchase:", error);
      alert(error instanceof Error ? error.message : "Could not delete purchase.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <main className="page-main">
        <div className="page-content">
          Loading purchase...
        </div>
      </main>
    );
  }

  if (!purchase) {
    return (
      <main className="page-main">
        <div className="page-content">
          <button
            onClick={() =>
              router.push("/dashboard/purchases")
            }
            className="btn-ghost"
          >
            ← Back to Purchases
          </button>

          <div className="card mt-6">
            <h2 className="text-xl">
              Purchase not found
            </h2>

            <p className="text-muted mt-2">
              This purchase record does not exist.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-main">

      <header className="site-header">
        <h1 className="text-xl">
          Gaurav Marbles
        </h1>

        <p className="text-muted">
          Purchase Details
        </p>
      </header>

      <div className="page-content">

        <button
          onClick={() =>
            router.push("/dashboard/purchases")
          }
          className="btn-ghost"
        >
          ← Back to Purchases
        </button>

        <div className="mt-4 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl">
                Purchase #{purchase.purchaseNumber}
              </h2>

              <p className="text-muted mt-1">
                {formatDisplayDate(purchase.purchaseDate)}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() =>
                  router.push(
                    `/dashboard/purchases/edit/${params.id}`
                  )
                }
                className="btn-secondary"
              >
                Edit Purchase
              </button>

              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn-primary"
                style={{
                  background: "#dc2626",
                }}
              >
                {deleting ? "Deleting..." : "Delete Purchase"}
              </button>
            </div>
          </div>
        </div>

        {/* Supplier Details */}

        <div className="card mb-6">

          <h3 className="text-base font-semibold mb-4">
            Supplier Details
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">

            <div>
              <p className="text-muted">
                Supplier
              </p>

              <div className="flex items-center gap-2 mt-1">
                <p className="font-medium">
                  {purchase.supplierName}
                </p>
                <Link
                  href={`/dashboard/accounts/supplier-ledger?party=${encodeURIComponent(purchase.supplierName)}`}
                  className="text-xs font-semibold text-purple-600 hover:text-purple-800 underline"
                  title="View Tally-Style Supplier Ledger"
                >
                  View Ledger ↗
                </Link>
              </div>
            </div>

            <div>
              <p className="text-muted">
                Invoice Number
              </p>

              <p className="font-medium mt-1 font-mono text-blue-700">
                {purchase.supplierInvoice || "—"}
              </p>
            </div>

            <div>
              <p className="text-muted">
                Purchase Date
              </p>

              <p className="font-medium mt-1">
                {formatDisplayDate(purchase.purchaseDate)}
              </p>
            </div>

            <div>
              <p className="text-muted">
                Payment Method
              </p>

              <p className="font-medium mt-1">
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800">
                  {purchase.paymentMethod || "Cash"}
                </span>
              </p>
            </div>

          </div>
        </div>

        {/* Products */}

        <div className="card mb-6">

          <h3 className="text-base font-semibold mb-4">
            Purchased Products ({(purchase.items || []).length})
          </h3>

          <div className="table-wrapper">

            <table className="data-table">

              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Unit</th>
                  <th>Purchase Price</th>
                  <th>Selling Price</th>
                  <th>Total</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>

              <tbody>

                {(purchase.items || []).map((item, index) => (

                  <tr key={index}>

                    <td className="font-medium">
                      {item.productId ? (
                        <Link
                          href={`/dashboard/products/${item.productId}`}
                          className="text-blue-600 hover:underline"
                          title="View Product Details"
                        >
                          {item.productName}
                        </Link>
                      ) : (
                        item.productName
                      )}
                    </td>

                    <td className="font-semibold">
                      {item.quantity.toLocaleString("en-IN")}
                    </td>

                    <td>
                      {item.unit}
                    </td>

                    <td>
                      ₹{item.purchasePrice.toLocaleString("en-IN")}
                    </td>

                    <td className="text-emerald-700 font-medium">
                      {item.sellingPrice !== undefined && item.sellingPrice !== null ? `₹${Number(item.sellingPrice).toLocaleString("en-IN")}` : "—"}
                    </td>

                    <td className="font-bold">
                      ₹{item.total.toLocaleString("en-IN")}
                    </td>

                    <td className="text-center">
                      {item.productId ? (
                        <Link
                          href={`/dashboard/products/${item.productId}`}
                          className="btn-secondary text-xs px-2.5 py-1"
                        >
                          View Product
                        </Link>
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>
        </div>

        {/* Total */}

        <div className="card">

          <div className="flex justify-end">

            <div className="text-right">

              <p className="text-muted">
                Total Purchase Amount
              </p>

              <p className="text-2xl font-bold mt-1">
                ₹{purchase.totalAmount.toLocaleString("en-IN")}
              </p>

            </div>

          </div>

        </div>

      </div>

    </main>
  );
}