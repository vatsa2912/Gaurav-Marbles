"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  reconcileCustomerBalance,
  getSalePaymentStatus,
  getEffectiveSalePaid,
  type CustomerSale,
  type CustomerPaymentRecord,
} from "@/lib/customerBalance";
import { formatDisplayDate, compareDatesDesc, getTodayDateString } from "@/lib/dateUtils";

type Customer = {
  id: string;
  name: string;
  phone?: string;
  address?: string;
};

type SaleItem = {
  productName: string;
  quantity: number;
  unit: string;
  sellingPrice: number;
  costPrice?: number;
  costTotal?: number;
  total: number;
};

type Sale = CustomerSale & {
  items: SaleItem[];
};

export default function CustomerDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const customerId = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<CustomerPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<CustomerPaymentRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(getTodayDateString());
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "UPI" | "Bank Transfer" | "Cheque">("Cash");
  const [selectedSaleId, setSelectedSaleId] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const loadCustomerDetails = async () => {
      try {
        setLoading(true);
        setError("");

        // Get customer
        const customerRef = doc(db, "customers", customerId);
        const customerSnap = await getDoc(customerRef);

        if (!customerSnap.exists()) {
          if (isMounted) setError("Customer not found.");
          return;
        }

        const customerData = customerSnap.data();
        const customerName = customerData.name || "";

        if (isMounted) {
          setCustomer({
            id: customerSnap.id,
            name: customerName,
            phone: customerData.phone || "",
            address: customerData.address || "",
          });
        }

        // Get customer's sales (both by customerId and customerName fallback)
        const salesPromises = [
          getDocs(query(collection(db, "sales"), where("customerId", "==", customerId))),
        ];
        if (customerName) {
          salesPromises.push(
            getDocs(query(collection(db, "sales"), where("customerName", "==", customerName)))
          );
        }

        const paymentsPromises = [
          getDocs(query(collection(db, "payments"), where("customerId", "==", customerId))),
        ];
        if (customerName) {
          paymentsPromises.push(
            getDocs(query(collection(db, "payments"), where("customerName", "==", customerName)))
          );
        }

        const [salesSnapshots, paymentsSnapshots] = await Promise.all([
          Promise.all(salesPromises),
          Promise.all(paymentsPromises),
        ]);

        if (!isMounted) return;

        // Deduplicate sales
        const salesMap = new Map<string, Sale>();
        for (const snap of salesSnapshots) {
          for (const docSnap of snap.docs) {
            if (!salesMap.has(docSnap.id)) {
              const data = docSnap.data();
              salesMap.set(docSnap.id, {
                id: docSnap.id,
                saleNumber: Number(data.saleNumber) || 0,
                saleDate: data.saleDate || "",
                dueDate: data.dueDate || "",
                customerId: data.customerId || customerId,
                customerName: data.customerName || customerName,
                totalAmount: Number(data.totalAmount) || 0,
                paidAmount: data.paidAmount !== undefined ? Number(data.paidAmount) : undefined,
                receivedAmount: data.receivedAmount !== undefined ? Number(data.receivedAmount) : undefined,
                items: data.items || [],
              });
            }
          }
        }

        const salesData = Array.from(salesMap.values());
        salesData.sort((a, b) => compareDatesDesc(a.saleDate, b.saleDate));
        setSales(salesData);

        // Deduplicate payments
        const paymentsMap = new Map<string, CustomerPaymentRecord>();
        for (const snap of paymentsSnapshots) {
          for (const docSnap of snap.docs) {
            if (!paymentsMap.has(docSnap.id)) {
              paymentsMap.set(docSnap.id, {
                id: docSnap.id,
                ...(docSnap.data() as CustomerPaymentRecord),
              });
            }
          }
        }

        const paymentsData = Array.from(paymentsMap.values());
        paymentsData.sort((a, b) => compareDatesDesc(a.paymentDate, b.paymentDate));
        setPayments(paymentsData);
      } catch (err) {
        console.error("Error loading customer details:", err);
        if (isMounted) setError("Failed to load customer details.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (customerId) {
      loadCustomerDetails();
    }
    return () => {
      isMounted = false;
    };
  }, [customerId, refreshTrigger]);

  const handleOpenCreateModal = () => {
    setEditingPayment(null);
    setPaymentAmount(totalOutstanding > 0 ? String(totalOutstanding) : "");
    setPaymentDate(getTodayDateString());
    setPaymentMethod("Cash");
    setSelectedSaleId("");
    setPaymentNotes("");
    setPaymentError("");
    setShowPaymentModal(true);
  };

  const handleOpenEditModal = (payment: CustomerPaymentRecord) => {
    setEditingPayment(payment);
    setPaymentAmount(String(payment.amount));
    setPaymentDate(payment.paymentDate || getTodayDateString());
    setPaymentMethod((payment.paymentMethod as "Cash" | "UPI" | "Bank Transfer" | "Cheque") || "Cash");
    setSelectedSaleId(payment.saleId || "");
    setPaymentNotes(payment.notes || "");
    setPaymentError("");
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    const numAmount = Number(paymentAmount);
    if (isNaN(numAmount) || !Number.isFinite(numAmount) || numAmount <= 0) {
      setPaymentError("Please enter a valid payment amount greater than zero.");
      return;
    }

    try {
      setSavingPayment(true);
      setPaymentError("");

      const targetSale = selectedSaleId ? sales.find((s) => s.id === selectedSaleId) : null;

      if (editingPayment) {
        // Edit existing payment
        await runTransaction(db, async (transaction) => {
          const paymentRef = doc(db, "payments", editingPayment.id!);
          const oldAmt = Number(editingPayment.amount) || 0;
          const oldSaleId = editingPayment.saleId;
          const newSaleId = targetSale?.id || null;

          // 1. Revert previous sale allocation if it had one
          if (oldSaleId) {
            const oldSaleRef = doc(db, "sales", oldSaleId);
            const oldSaleSnap = await transaction.get(oldSaleRef);
            if (oldSaleSnap.exists()) {
              const oldSaleData = oldSaleSnap.data() as CustomerSale;
              const currentPaid = getEffectiveSalePaid(oldSaleData);
              const restoredPaid = Math.max(0, currentPaid - oldAmt);
              transaction.update(oldSaleRef, {
                receivedAmount: restoredPaid,
                paidAmount: restoredPaid,
              });
            }
          }

          // 2. Apply to new sale allocation if selected
          let targetSaleNumber: number | null = null;
          if (newSaleId) {
            const newSaleRef = doc(db, "sales", newSaleId);
            const newSaleSnap = await transaction.get(newSaleRef);
            if (newSaleSnap.exists()) {
              const newSaleData = newSaleSnap.data() as CustomerSale;
              targetSaleNumber = newSaleData.saleNumber || null;
              const currentPaid = oldSaleId === newSaleId
                ? Math.max(0, getEffectiveSalePaid(newSaleData) - oldAmt)
                : getEffectiveSalePaid(newSaleData);
              const appliedPaid = currentPaid + numAmount;
              transaction.update(newSaleRef, {
                receivedAmount: appliedPaid,
                paidAmount: appliedPaid,
              });
            }
          }

          // 3. Update payment record
          transaction.update(paymentRef, {
            amount: numAmount,
            paymentDate: paymentDate || getTodayDateString(),
            paymentMethod,
            saleId: newSaleId,
            saleNumber: targetSaleNumber,
            notes: paymentNotes.trim(),
          });
        });
      } else {
        // Create new payment
        if (targetSale) {
          await runTransaction(db, async (transaction) => {
            const saleRef = doc(db, "sales", targetSale.id);
            const saleSnap = await transaction.get(saleRef);
            if (!saleSnap.exists()) throw new Error("Selected sale does not exist.");

            const sData = saleSnap.data() as CustomerSale;
            const currentPaid = getEffectiveSalePaid(sData);
            const newPaid = currentPaid + numAmount;

            const paymentRef = doc(collection(db, "payments"));
            transaction.set(paymentRef, {
              customerId,
              customerName: customer.name,
              saleId: targetSale.id,
              saleNumber: targetSale.saleNumber || 0,
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
        } else {
          // Unallocated account credit
          await runTransaction(db, async (transaction) => {
            const paymentRef = doc(collection(db, "payments"));
            transaction.set(paymentRef, {
              customerId,
              customerName: customer.name,
              saleId: null,
              saleNumber: null,
              amount: numAmount,
              paymentDate: paymentDate || getTodayDateString(),
              paymentMethod,
              notes: paymentNotes.trim(),
              createdAt: serverTimestamp(),
            });
          });
        }
      }

      setShowPaymentModal(false);
      setEditingPayment(null);
      setPaymentAmount("");
      setSelectedSaleId("");
      setPaymentNotes("");
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.error("Error recording payment:", err);
      setPaymentError(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDeletePayment = async (payment: CustomerPaymentRecord) => {
    if (!payment.id) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete this payment receipt of ₹${payment.amount.toLocaleString("en-IN")}?`
    );
    if (!confirmed) return;

    try {
      if (payment.saleId) {
        await runTransaction(db, async (transaction) => {
          const saleRef = doc(db, "sales", payment.saleId!);
          const paymentRef = doc(db, "payments", payment.id!);
          const saleSnap = await transaction.get(saleRef);

          if (saleSnap.exists()) {
            const sData = saleSnap.data() as CustomerSale;
            const currentPaid = getEffectiveSalePaid(sData);
            const newPaid = Math.max(0, currentPaid - (Number(payment.amount) || 0));
            transaction.update(saleRef, {
              receivedAmount: newPaid,
              paidAmount: newPaid,
            });
          }
          transaction.delete(paymentRef);
        });
      } else {
        await deleteDoc(doc(db, "payments", payment.id));
      }

      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.error("Error deleting payment:", err);
      alert("Failed to delete payment receipt.");
    }
  };

  const balanceSummary = reconcileCustomerBalance(sales, payments);
  const totalInvoiced = balanceSummary.totalInvoiced;
  const totalPaid = balanceSummary.totalPaid;
  const totalOutstanding = balanceSummary.totalOutstanding;
  const totalCredit = balanceSummary.totalCredit;

  const totalProfit = sales.reduce((sum, sale) =>
    sum + sale.items.reduce((s, item) => {
      const qty = Number(item.quantity) || 0;
      const sp = Number(item.sellingPrice) || 0;
      const totalSelling = Number(item.total) || qty * sp;
      const costTotal =
        item.costTotal !== undefined && !isNaN(Number(item.costTotal))
          ? Number(item.costTotal)
          : ((Number(item.costPrice) || 0) * qty);
      return s + totalSelling - costTotal;
    }, 0), 0
  );

  if (loading) {
    return (
      <main className="page-main">
        <div className="page-content">
          <p>Loading customer details...</p>
        </div>
      </main>
    );
  }

  if (error || !customer) {
    return (
      <main className="page-main">
        <div className="page-content">
          <div className="flex gap-3">
            <button
              onClick={() =>
                router.push(`/dashboard/customers/edit/${customerId}`)
              }
              className="btn-primary"
            >
              Edit Customer
            </button>

            <button
              onClick={() => router.push("/dashboard/customers")}
              className="btn-secondary"
            >
              ← Back to Customers
            </button>
          </div>

          <div className="card" style={{ marginTop: "20px" }}>
            <p className="text-error">{error || "Customer not found."}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-main">
      <div className="page-content">
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1>Customer Details</h1>
            <p className="text-muted">
              View customer information, ledger balances, and sales history
            </p>
          </div>

          <button
            onClick={() => router.push("/dashboard/customers")}
            className="btn-secondary"
          >
            ← Back to Customers
          </button>
        </div>

        {/* Customer Information */}
        <div className="card" style={{ marginBottom: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <h2>{customer.name}</h2>

            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <Link
                href={`/dashboard/accounts/customer-ledger?partyId=${customerId}`}
                className="btn-secondary"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <span>📖</span> View Ledger
              </Link>
              <button
                onClick={() =>
                  router.push(`/dashboard/customers/edit/${customerId}`)
                }
                className="btn-primary"
              >
                Edit Customer
              </button>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              marginTop: "16px",
            }}
          >
            <div>
              <p className="text-muted">Phone</p>
              <p>{customer.phone || "Not provided"}</p>
            </div>

            <div>
              <p className="text-muted">Address</p>
              <p>{customer.address || "Not provided"}</p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div className="card">
            <p className="text-muted">Total Sales</p>
            <h2>{sales.length}</h2>
          </div>

          <div className="card">
            <p className="text-muted">Total Invoiced</p>
            <h2>₹{totalInvoiced.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</h2>
          </div>

          <div className="card">
            <p className="text-muted">Total Received</p>
            <h2 className="text-green-600">
              ₹{totalPaid.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </h2>
          </div>

          <div className="card">
            <p className="text-muted">Outstanding Balance</p>
            <h2 style={{ color: totalOutstanding > 0 ? "#dc2626" : "#16a34a" }}>
              ₹{totalOutstanding.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </h2>
            {totalCredit > 0 && (
              <p className="text-xs text-blue-600 mt-1 font-medium">
                Credit Balance: ₹{totalCredit.toLocaleString("en-IN")}
              </p>
            )}
          </div>

          {balanceSummary.overdueAmount > 0 && (
            <div className="card" style={{ background: "#fef2f2", borderColor: "#fecaca" }}>
              <p className="text-red-700 font-semibold text-xs uppercase">Overdue Amount</p>
              <h2 className="text-red-600">
                ₹{balanceSummary.overdueAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </h2>
            </div>
          )}

          <div className="card">
            <p className="text-muted">Total Profit</p>
            <h2 style={{ color: totalProfit >= 0 ? "#16a34a" : "#dc2626" }}>
              ₹{totalProfit.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </h2>
          </div>
        </div>

        {/* Payments & Ledger Receipts */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold">Payments & Ledger Receipts</h2>
              <p className="text-muted text-sm mt-0.5">Direct payments, installment receipts, and account credits</p>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="btn-primary"
            >
              + Record Payment
            </button>
          </div>

          {payments.length === 0 ? (
            <p className="text-muted" style={{ marginTop: "12px" }}>
              No payments recorded yet for this customer.
            </p>
          ) : (
            <div className="table-wrapper" style={{ marginTop: "12px" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Allocated To</th>
                    <th>Notes</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{formatDisplayDate(payment.paymentDate)}</td>
                      <td className="font-semibold text-green-700">
                        ₹{(Number(payment.amount) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </td>
                      <td>{payment.paymentMethod || "Cash"}</td>
                      <td>
                        {payment.saleNumber ? (
                          <span className="font-medium text-blue-600">
                            Sale #{payment.saleNumber}
                          </span>
                        ) : (
                          <span className="text-muted italic">General Account Credit</span>
                        )}
                      </td>
                      <td className="text-muted">{payment.notes || "—"}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(payment)}
                            className="text-xs text-blue-600 hover:underline font-medium"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePayment(payment)}
                            className="text-xs text-red-600 hover:underline font-medium"
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
          )}
        </div>

        {/* Sales History */}
        <div className="card">
          <h2>Sales History</h2>

          {sales.length === 0 ? (
            <p className="text-muted" style={{ marginTop: "16px" }}>
              No sales found for this customer.
            </p>
          ) : (
            <div className="table-wrapper" style={{ marginTop: "16px" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sale No.</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Selling Price</th>
                    <th>Total Selling</th>
                    <th>Purchase Cost</th>
                    <th>Total Cost</th>
                    <th>Profit</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {sales.map((sale) => {
                    const status = getSalePaymentStatus(sale);
                    const statusBadgeClass =
                      status === "paid"
                        ? "bg-green-100 text-green-800"
                        : status === "partial"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800";

                    return sale.items.length === 0 ? (
                      <tr key={sale.id}>
                        <td>#{sale.saleNumber}</td>
                        <td>{formatDisplayDate(sale.saleDate)}</td>
                        <td>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusBadgeClass}`}>
                            {status.toUpperCase()}
                          </span>
                        </td>
                        <td colSpan={7} className="text-muted">No items</td>
                        <td>
                          <button onClick={() => router.push(`/dashboard/sales/${sale.id}`)} className="btn-ghost">View</button>
                        </td>
                      </tr>
                    ) : (
                      sale.items.map((item, itemIdx) => {
                        const qty = Number(item.quantity) || 0;
                        const sp = Number(item.sellingPrice) || 0;
                        const totalSelling = Number(item.total) || qty * sp;
                        const costPerUnit = Number(item.costPrice) || 0;
                        const costTotal =
                          item.costTotal !== undefined && !isNaN(Number(item.costTotal))
                            ? Number(item.costTotal)
                            : costPerUnit * qty;
                        const profit = totalSelling - costTotal;
                        return (
                          <tr key={`${sale.id}-${itemIdx}`}>
                            {itemIdx === 0 && (
                              <>
                                <td rowSpan={sale.items.length}>#{sale.saleNumber}</td>
                                <td rowSpan={sale.items.length}>
                                  {formatDisplayDate(sale.saleDate)}
                                </td>
                                <td rowSpan={sale.items.length}>
                                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusBadgeClass}`}>
                                    {status.toUpperCase()}
                                  </span>
                                </td>
                              </>
                            )}
                            <td className="font-medium">{item.productName}</td>
                            <td>{qty} {item.unit}</td>
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
                              {costTotal > 0 ? `₹${profit.toLocaleString("en-IN")}` : <span className="text-muted">—</span>}
                            </td>
                            {itemIdx === 0 && (
                              <td rowSpan={sale.items.length}>
                                <button onClick={() => router.push(`/dashboard/sales/${sale.id}`)} className="btn-ghost">View</button>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
                maxWidth: "500px",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold">
                  {editingPayment ? "Edit Payment Receipt" : "Record Customer Payment"}
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
                Customer: <strong className="text-gray-800">{customer.name}</strong> • Current Outstanding:{" "}
                <strong style={{ color: totalOutstanding > 0 ? "#dc2626" : "#16a34a" }}>
                  ₹{totalOutstanding.toLocaleString("en-IN")}
                </strong>
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
                    {totalOutstanding > 0 && (
                      <button
                        type="button"
                        onClick={() => setPaymentAmount(String(totalOutstanding))}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Fill Outstanding (₹{totalOutstanding.toLocaleString("en-IN")})
                      </button>
                    )}
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
                  <label>Apply Payment To</label>
                  <select
                    value={selectedSaleId}
                    onChange={(e) => {
                      const sId = e.target.value;
                      setSelectedSaleId(sId);
                      if (sId) {
                        const targetSale = sales.find((s) => s.id === sId);
                        if (targetSale) {
                          const due = Math.max(0, targetSale.totalAmount - getEffectiveSalePaid(targetSale));
                          if (due > 0) setPaymentAmount(String(due));
                        }
                      }
                    }}
                  >
                    <option value="">General Account Credit / Unallocated</option>
                    {sales
                      .filter((s) => Math.max(0, s.totalAmount - getEffectiveSalePaid(s)) > 0)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          Sale #{s.saleNumber} ({formatDisplayDate(s.saleDate)}) — Due: ₹{Math.max(0, s.totalAmount - getEffectiveSalePaid(s)).toLocaleString("en-IN")}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Notes / Reference (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. UPI Ref, Bank Transaction No, Cheque #"
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
      </div>
    </main>
  );
}