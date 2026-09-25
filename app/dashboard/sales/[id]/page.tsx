"use client";

import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  normaliseLots,
  restoreFromAllocations,
  totalStock,
  type CostAllocation,
  type StockLot,
} from "@/lib/stockLots";
import {
  getSalePaymentStatus,
  getEffectiveSalePaid,
  type CustomerPaymentRecord,
  type CustomerSale,
} from "@/lib/customerBalance";
import {
  formatDisplayDate,
  getTodayDateString,
  compareDatesDesc,
} from "@/lib/dateUtils";
import { useToast } from "@/components/ui/ToastContext";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

type SaleItem = {
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

type Sale = CustomerSale & {
  saleNumber: number;
  customerName: string;
  customerPhone?: string;
  saleDate: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  discount: number;
  totalAmount: number;
  notes: string;
  createdAt?: unknown;
};

export default function SaleDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const [sale, setSale] = useState<Sale | null>(null);
  const [payments, setPayments] = useState<CustomerPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const { showToast } = useToast();
  const [deleteSaleModalOpen, setDeleteSaleModalOpen] = useState(false);
  const [deletePaymentModalOpen, setDeletePaymentModalOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<CustomerPaymentRecord | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<CustomerPaymentRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(getTodayDateString());
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "UPI" | "Bank Transfer" | "Cheque">("Cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const saleId = (params?.id as string) || "";

  useEffect(() => {
    let isMounted = true;
    const loadSale = async () => {
      try {
        if (!saleId) {
          if (isMounted) setLoading(false);
          return;
        }

        const saleRef = doc(db, "sales", saleId);
        const snapshot = await getDoc(saleRef);

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
                  sellingPrice: Number(rawData.rate ?? rawData.sellingPrice) || 0,
                  costPrice: Number(rawData.costPrice) || 0,
                  total: Number(rawData.totalAmount || rawData.total) || 0,
                },
              ];
            }
            setSale({ ...rawData, items, id: snapshot.id } as Sale);
          } else {
            setSale(null);
          }
        }

        // Fetch payments for this sale
        const paymentsQuery = query(
          collection(db, "payments"),
          where("saleId", "==", saleId)
        );
        const paymentsSnapshot = await getDocs(paymentsQuery);
        if (isMounted) {
          const loadedPayments = paymentsSnapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as CustomerPaymentRecord),
          }));
          loadedPayments.sort((a, b) => compareDatesDesc(a.paymentDate, b.paymentDate));
          setPayments(loadedPayments);
        }
      } catch (error) {
        console.error("Error loading sale:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (saleId) {
      loadSale();
    } else {
      setLoading(false);
    }
    return () => {
      isMounted = false;
    };
  }, [saleId, refreshTrigger]);

  const handleOpenCreatePaymentModal = (due: number) => {
    setEditingPayment(null);
    setPaymentAmount(String(due));
    setPaymentDate(getTodayDateString());
    setPaymentMethod("Cash");
    setPaymentNotes("");
    setPaymentError("");
    setShowPaymentModal(true);
  };

  const handleOpenEditPaymentModal = (p: CustomerPaymentRecord) => {
    setEditingPayment(p);
    setPaymentAmount(String(p.amount));
    setPaymentDate(p.paymentDate || getTodayDateString());
    setPaymentMethod((p.paymentMethod as "Cash" | "UPI" | "Bank Transfer" | "Cheque") || "Cash");
    setPaymentNotes(p.notes || "");
    setPaymentError("");
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sale) return;

    const numAmount = Number(paymentAmount);
    if (isNaN(numAmount) || !Number.isFinite(numAmount) || numAmount <= 0) {
      setPaymentError("Please enter a valid payment amount greater than zero.");
      return;
    }

    try {
      setSavingPayment(true);
      setPaymentError("");

      if (editingPayment) {
        await runTransaction(db, async (transaction) => {
          const saleRef = doc(db, "sales", saleId);
          const paymentRef = doc(db, "payments", editingPayment.id!);
          const saleSnap = await transaction.get(saleRef);
          if (!saleSnap.exists()) throw new Error("Sale no longer exists.");

          const saleData = saleSnap.data() as Sale;
          const currentPaid = getEffectiveSalePaid(saleData);
          const oldAmt = Number(editingPayment.amount) || 0;
          const diff = numAmount - oldAmt;
          const newPaid = Math.max(0, currentPaid + diff);

          transaction.update(paymentRef, {
            amount: numAmount,
            paymentDate: paymentDate || getTodayDateString(),
            paymentMethod,
            notes: paymentNotes.trim(),
          });

          transaction.update(saleRef, {
            receivedAmount: newPaid,
            paidAmount: newPaid,
          });
        });
      } else {
        await runTransaction(db, async (transaction) => {
          const saleRef = doc(db, "sales", saleId);
          const saleSnap = await transaction.get(saleRef);
          if (!saleSnap.exists()) {
            throw new Error("Sale no longer exists.");
          }

          const saleData = saleSnap.data() as Sale;
          const currentPaid = getEffectiveSalePaid(saleData);
          const newPaid = currentPaid + numAmount;

          const newPaymentRef = doc(collection(db, "payments"));
          transaction.set(newPaymentRef, {
            customerId: saleData.customerId || "",
            customerName: saleData.customerName || "",
            saleId: saleId,
            saleNumber: saleData.saleNumber || 0,
            amount: numAmount,
            paymentDate: paymentDate || getTodayDateString(),
            paymentMethod,
            notes: paymentNotes.trim(),
            createdAt: serverTimestamp(),
          });

          transaction.update(saleRef, {
            receivedAmount: newPaid,
            paidAmount: newPaid,
          });
        });
      }

      setShowPaymentModal(false);
      setEditingPayment(null);
      setPaymentAmount("");
      setPaymentNotes("");
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.error("Error recording payment:", err);
      setPaymentError(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setSavingPayment(false);
    }
  };

  const openDeletePaymentModal = (payment: CustomerPaymentRecord) => {
    setPaymentToDelete(payment);
    setDeletePaymentModalOpen(true);
  };

  const handleConfirmDeletePayment = async () => {
    if (!paymentToDelete?.id) return;

    try {
      setDeletingPayment(true);
      await runTransaction(db, async (transaction) => {
        const paymentRef = doc(db, "payments", paymentToDelete.id!);
        const saleRef = doc(db, "sales", saleId);

        const saleSnap = await transaction.get(saleRef);
        if (saleSnap.exists()) {
          const saleData = saleSnap.data() as Sale;
          const currentPaid = getEffectiveSalePaid(saleData);
          const newPaid = Math.max(0, currentPaid - (Number(paymentToDelete.amount) || 0));
          transaction.update(saleRef, {
            receivedAmount: newPaid,
            paidAmount: newPaid,
          });
        }

        transaction.delete(paymentRef);
      });

      showToast("Payment receipt deleted successfully", "success");
      setDeletePaymentModalOpen(false);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.error("Error deleting payment:", err);
      showToast("Failed to delete payment.", "error");
    } finally {
      setDeletingPayment(false);
    }
  };

  const handleConfirmDeleteSale = async () => {
    try {
      setDeleting(true);

      // Pre-fetch any linked payments before transaction
      const paymentsQuery = query(collection(db, "payments"), where("saleId", "==", saleId));
      const paymentsSnap = await getDocs(paymentsQuery);
      const linkedPaymentDocIds = paymentsSnap.docs.map((d) => d.id);

      await runTransaction(db, async (transaction) => {
        const saleRef = doc(db, "sales", saleId);
        const saleSnapshot = await transaction.get(saleRef);
        if (!saleSnapshot.exists()) throw new Error("Sale not found.");

        const saleData = saleSnapshot.data() as Sale;
        const saleItems = saleData.items || [];
        const saleDateStr = saleData.saleDate || "2000-01-01";

        // Unique product IDs
        const productIds = Array.from(
          new Set(saleItems.map((i) => i.productId).filter(Boolean))
        );

        // Read all affected products
        const snaps: Record<string, Awaited<ReturnType<typeof transaction.get>>> = {};
        for (const pid of productIds) {
          const snap = await transaction.get(doc(db, "products", pid));
          if (!snap.exists()) throw new Error(`Product "${pid}" no longer exists.`);
          snaps[pid] = snap;
        }

        // Build working lots
        const lotsMap: Record<string, StockLot[]> = {};
        for (const pid of productIds) {
          lotsMap[pid] = normaliseLots({
            id: pid,
            ...(snaps[pid].data() as { stock?: number; purchasePrice?: number; stockLots?: StockLot[] }),
          });
        }

        // Restore stock from costAllocations (or legacy costPrice fallback)
        for (const item of saleItems) {
          const pid = item.productId;
          if (!pid) continue;
          if (item.costAllocations?.length) {
            lotsMap[pid] = restoreFromAllocations(lotsMap[pid], item.costAllocations, saleDateStr);
          } else {
            const costPrice = item.costPrice ?? 0;
            lotsMap[pid] = restoreFromAllocations(
              lotsMap[pid],
              [{
                lotId: `legacy_${pid}`,
                purchasePrice: costPrice,
                quantity: item.quantity,
                totalCost: costPrice * item.quantity,
                purchasedAt: saleDateStr,
              }],
              saleDateStr
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

        // Clean up linked payments
        for (const payId of linkedPaymentDocIds) {
          transaction.delete(doc(db, "payments", payId));
        }

        // Delete the sale
        transaction.delete(saleRef);
      });

      showToast("Sale deleted and stock restored successfully", "success");
      router.push("/dashboard/sales");
    } catch (error) {
      console.error("Error deleting sale:", error);
      showToast(error instanceof Error ? error.message : "Could not delete sale.", "error");
    } finally {
      setDeleting(false);
      setDeleteSaleModalOpen(false);
    }
  };

  if (loading) {
    return (
      <main className="page-main">
        <header className="site-header">
          <h1 className="text-xl">Gaurav Marbles</h1>
          <p className="text-muted">Sale Details</p>
        </header>

        <div className="page-content">
          <div className="card text-center">
            Loading sale...
          </div>
        </div>
      </main>
    );
  }

  if (!sale) {
    return (
      <main className="page-main">
        <header className="site-header">
          <h1 className="text-xl">Gaurav Marbles</h1>
          <p className="text-muted">Sale Details</p>
        </header>

        <div className="page-content">
          <div className="card text-center">
            <h2 className="text-xl font-semibold">
              Sale not found
            </h2>

            <button
              onClick={() => router.push("/dashboard/sales")}
              className="btn-primary mt-5"
            >
              Back to Sales
            </button>
          </div>
        </div>
      </main>
    );
  }

  const effectivePaid = getEffectiveSalePaid(sale);
  const balanceDue = Math.max(0, sale.totalAmount - effectivePaid);
  const paymentStatus = getSalePaymentStatus(sale);

  const statusBadgeStyle =
    paymentStatus === "paid"
      ? { bg: "#dcfce7", color: "#166534", border: "#86efac" }
      : paymentStatus === "partial"
      ? { bg: "#fef9c3", color: "#854d0e", border: "#fde047" }
      : paymentStatus === "overdue"
      ? { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" }
      : { bg: "#f3f4f6", color: "#374151", border: "#d1d5db" };

  return (
    <main className="page-main">
      <header className="site-header">
        <h1 className="text-xl">Gaurav Marbles</h1>
        <p className="text-muted">Sale Details</p>
      </header>

      <div className="page-content-narrow">
        <div className="mb-6">
          <button
            onClick={() => router.push("/dashboard/sales")}
            className="btn-ghost"
          >
            ← Back to Sales
          </button>

          <div className="flex items-center justify-between mt-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl">
                  Sale #{sale.saleNumber}
                </h2>
                <span
                  style={{
                    backgroundColor: statusBadgeStyle.bg,
                    color: statusBadgeStyle.color,
                    border: `1px solid ${statusBadgeStyle.border}`,
                    padding: "3px 10px",
                    borderRadius: "9999px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {paymentStatus}
                </span>
              </div>

              <div className="flex items-center gap-4 mt-1 text-muted text-sm">
                <span>Sale Date: {formatDisplayDate(sale.saleDate)}</span>
                {sale.dueDate && (
                  <span style={{ color: paymentStatus === "overdue" ? "#dc2626" : undefined, fontWeight: paymentStatus === "overdue" ? 600 : undefined }}>
                    • Due Date: {formatDisplayDate(sale.dueDate)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() =>
                  router.push(
                    `/dashboard/sales/edit/${saleId}`
                  )
                }
                className="btn-secondary"
              >
                Edit Sale
              </button>

              <button
                onClick={() => setDeleteSaleModalOpen(true)}
                disabled={deleting}
                className="btn-primary"
                style={{
                  background: "#dc2626",
                }}
              >
                {deleting ? "Deleting..." : "Delete Sale"}
              </button>
            </div>
          </div>
        </div>

        {/* Customer Details */}
        <div className="card mb-6">
          <h3 className="text-base font-semibold mb-4">
            Customer Details
          </h3>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <p className="text-muted text-sm">
                Customer Name
              </p>

              <div className="flex items-center gap-2 mt-1">
                <p className="font-medium">
                  {sale.customerName}
                </p>
                {sale.customerName && (
                  <Link
                    href={`/dashboard/accounts/customer-ledger?party=${encodeURIComponent(sale.customerName)}`}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
                    title="View Tally-Style Customer Ledger"
                  >
                    View Ledger ↗
                  </Link>
                )}
              </div>
            </div>

            <div>
              <p className="text-muted text-sm">
                Phone Number
              </p>

              <p className="mt-1 font-medium">
                {sale.customerPhone || "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Payment & Invoicing Overview */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">
              Payment & Invoicing
            </h3>

            {balanceDue > 0 && (
              <button
                type="button"
                onClick={() => handleOpenCreatePaymentModal(balanceDue)}
                className="btn-primary text-sm"
              >
                + Record Payment
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 mb-4">
            <div style={{ background: "#f9fafb", padding: "12px 16px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
              <span className="text-muted text-xs uppercase font-semibold">Total Invoiced</span>
              <p className="text-xl font-bold mt-1">₹{sale.totalAmount.toLocaleString("en-IN")}</p>
            </div>

            <div style={{ background: "#f0fdf4", padding: "12px 16px", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
              <span className="text-xs uppercase font-semibold text-green-800">Amount Received</span>
              <p className="text-xl font-bold text-green-700 mt-1">₹{effectivePaid.toLocaleString("en-IN")}</p>
            </div>

            <div style={{ background: balanceDue > 0 ? "#fef2f2" : "#f9fafb", padding: "12px 16px", borderRadius: "8px", border: `1px solid ${balanceDue > 0 ? "#fecaca" : "#e5e7eb"}` }}>
              <span className={`text-xs uppercase font-semibold ${balanceDue > 0 ? "text-red-800" : "text-muted"}`}>
                Balance Due
              </span>
              <p className={`text-xl font-bold mt-1 ${balanceDue > 0 ? "text-red-600" : "text-gray-700"}`}>
                ₹{balanceDue.toLocaleString("en-IN")}
              </p>
            </div>

            <div style={{ background: "#f9fafb", padding: "12px 16px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
              <span className="text-muted text-xs uppercase font-semibold">Payment Status</span>
              <p className="text-base font-bold mt-1 capitalize" style={{ color: statusBadgeStyle.color }}>
                {paymentStatus}
              </p>
              {sale.dueDate && (
                <p className="text-xs text-muted mt-0.5">Due: {formatDisplayDate(sale.dueDate)}</p>
              )}
            </div>
          </div>

          {payments.length > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid #e5e7eb" }}>
              <h4 className="text-sm font-semibold mb-3">Recorded Payment Receipts</h4>
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Notes</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td>{formatDisplayDate(p.paymentDate)}</td>
                        <td className="font-semibold text-green-700">₹{(Number(p.amount) || 0).toLocaleString("en-IN")}</td>
                        <td>{p.paymentMethod || "Cash"}</td>
                        <td className="text-muted">{p.notes || "—"}</td>
                        <td>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleOpenEditPaymentModal(p)}
                              className="text-xs text-blue-600 hover:underline font-medium"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => openDeletePaymentModal(p)}
                              className="text-xs text-red-600 hover:underline font-medium cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Products */}
        <div className="card mb-6">
          <h3 className="text-base font-semibold mb-4">
            Products
          </h3>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Unit</th>
                  <th>Selling Price</th>
                  <th>Total Selling</th>
                  <th>Purchase Cost</th>
                  <th>Total Cost</th>
                  <th>Profit</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>

              <tbody>
                {sale.items?.map((item, index) => {
                  const qty = Number(item.quantity) || 0;
                  const sp = Number(item.sellingPrice) || 0;
                  const totalSelling = item.total ?? qty * sp;
                  const costPerUnit = Number(item.costPrice) || 0;
                  const costTotal = Number(item.costTotal) ?? (costPerUnit * qty);
                  const profit = totalSelling - costTotal;
                  return (
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
                      <td>{qty}</td>
                      <td>{item.unit}</td>
                      <td>₹{sp.toLocaleString("en-IN")}</td>
                      <td>₹{totalSelling.toLocaleString("en-IN")}</td>
                      <td>
                        {costPerUnit > 0
                          ? `₹${costPerUnit.toLocaleString("en-IN")}`
                          : <span className="text-muted">—</span>}
                      </td>
                      <td>
                        {costTotal > 0
                          ? `₹${costTotal.toLocaleString("en-IN")}`
                          : <span className="text-muted">—</span>}
                      </td>
                      <td style={{ color: profit >= 0 ? "#16a34a" : "#dc2626", fontWeight: 500 }}>
                        ₹{profit.toLocaleString("en-IN")}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Total & Profit Card */}
        <div className="card">
          <div className="flex justify-end">
            <div style={{ minWidth: "16rem" }}>
              {(() => {
                const totalProfit = (sale.items || []).reduce((sum, item) => {
                  const qty = Number(item.quantity) || 0;
                  const sp = Number(item.sellingPrice) || 0;
                  const totalSelling = item.total ?? qty * sp;
                  const costTotal = Number(item.costTotal) ?? ((Number(item.costPrice) || 0) * qty);
                  return sum + totalSelling - costTotal;
                }, 0);
                return (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "0.75rem", fontSize: "1rem" }}>
                      <span>Total Profit</span>
                      <span style={{ color: totalProfit >= 0 ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                        ₹{totalProfit.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "0.75rem", borderTop: "2px solid #374151", fontWeight: 700, fontSize: "1.1rem" }}>
                      <span>Total Invoiced</span>
                      <span>₹{sale.totalAmount.toLocaleString("en-IN")}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Record Payment Modal */}
        {showPaymentModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 50,
              padding: "16px",
            }}
          >
            <div
              className="card"
              style={{
                width: "100%",
                maxWidth: "480px",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">
                  {editingPayment ? "Edit Payment Receipt" : "Record Payment"}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="btn-ghost"
                  style={{ fontSize: "1.2rem", padding: "4px 8px" }}
                >
                  ✕
                </button>
              </div>

              <p className="text-muted text-sm mb-4">
                Recording payment for Sale #{sale.saleNumber} ({sale.customerName})
              </p>

              {paymentError && (
                <div style={{ background: "#fee2e2", border: "1px solid #f87171", color: "#991b1b", padding: "10px 14px", borderRadius: "6px", marginBottom: "16px", fontSize: "0.875rem" }}>
                  {paymentError}
                </div>
              )}

              <form onSubmit={handleRecordPayment} className="space-y-4">
                <div className="form-field">
                  <div className="flex items-center justify-between">
                    <label>Amount (₹) *</label>
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(String(balanceDue))}
                      className="text-xs font-semibold text-blue-600 hover:underline"
                    >
                      Fill Due (₹{balanceDue.toLocaleString("en-IN")})
                    </button>
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    placeholder="Enter payment amount"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Payment Date *</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Payment Method *</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as "Cash" | "UPI" | "Bank Transfer" | "Cheque")}
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / Online</option>
                    <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Notes / Reference (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Transaction ID, Cheque No., etc."
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4" style={{ borderTop: "1px solid #e5e7eb" }}>
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPayment}
                    className="btn-primary"
                  >
                    {savingPayment ? "Saving..." : editingPayment ? "Update Payment" : "Save Payment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Accessible Confirm Modal for Sale Deletion */}
        <ConfirmModal
          isOpen={deleteSaleModalOpen}
          title="Delete Customer Sale"
          message={`Are you sure you want to delete Sale #${sale?.saleNumber}? Deducted inventory stock lots will be restored, and linked payments will be cleared.`}
          confirmText="Restore Stock & Delete"
          cancelText="Cancel"
          isDanger={true}
          loading={deleting}
          onConfirm={handleConfirmDeleteSale}
          onCancel={() => setDeleteSaleModalOpen(false)}
        />

        {/* Accessible Confirm Modal for Payment Deletion */}
        <ConfirmModal
          isOpen={deletePaymentModalOpen}
          title="Delete Payment Receipt"
          message={`Are you sure you want to delete this payment of ₹${paymentToDelete?.amount ? Number(paymentToDelete.amount).toLocaleString("en-IN") : "0"}? The customer balance due will be updated.`}
          confirmText="Delete Receipt"
          cancelText="Cancel"
          isDanger={true}
          loading={deletingPayment}
          onConfirm={handleConfirmDeletePayment}
          onCancel={() => setDeletePaymentModalOpen(false)}
        />
      </div>
    </main>
  );
}