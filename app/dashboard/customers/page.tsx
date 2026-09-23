"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  reconcileCustomerBalance,
  type CustomerSale,
  type CustomerPaymentRecord,
  type CustomerBalanceSummary,
} from "@/lib/customerBalance";

type Customer = {
  id: string;
  name: string;
  phone: string;
  address: string;
  createdAt?: unknown;
};

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<CustomerSale[]>([]);
  const [payments, setPayments] = useState<CustomerPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchCustomersData = async () => {
      try {
        const [custSnap, salesSnap, paymentsSnap] = await Promise.all([
          getDocs(collection(db, "customers")),
          getDocs(collection(db, "sales")),
          getDocs(collection(db, "payments")),
        ]);
        if (!isMounted) return;

        const customerList = custSnap.docs.map((customerDoc) => ({
          id: customerDoc.id,
          ...customerDoc.data(),
        })) as Customer[];

        const salesList = salesSnap.docs.map((sDoc) => {
          const d = sDoc.data();
          return {
            id: sDoc.id,
            saleNumber: d.saleNumber,
            saleDate: d.saleDate,
            totalAmount: Number(d.totalAmount) || 0,
            paidAmount: d.paidAmount !== undefined ? Number(d.paidAmount) : undefined,
            receivedAmount: d.receivedAmount !== undefined ? Number(d.receivedAmount) : undefined,
            dueDate: d.dueDate,
            customerId: d.customerId,
            customerName: d.customerName,
          } as CustomerSale;
        });

        const paymentsList = paymentsSnap.docs.map((pDoc) => ({
          id: pDoc.id,
          ...pDoc.data(),
        })) as CustomerPaymentRecord[];

        setCustomers(customerList);
        setSales(salesList);
        setPayments(paymentsList);
      } catch (error) {
        console.error("Error loading customers:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCustomersData();

    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  const handleAddCustomer = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!name.trim()) {
      alert("Customer name is required.");
      return;
    }

    try {
      setSaving(true);

      await addDoc(collection(db, "customers"), {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        createdAt: serverTimestamp(),
      });

      setName("");
      setPhone("");
      setAddress("");

      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Error adding customer:", error);
      alert("Could not add customer.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this customer?"
    );

    if (!confirmed) return;

    try {
      // Check whether this customer has any sales
      const salesQuery = query(
        collection(db, "sales"),
        where("customerId", "==", id)
      );

      const salesSnapshot = await getDocs(salesQuery);

      if (!salesSnapshot.empty) {
        alert(
          "This customer cannot be deleted because they have existing sales records."
        );
        return;
      }

      // Delete customer only if there are no sales
      await deleteDoc(doc(db, "customers", id));

      setCustomers((current) =>
        current.filter((customer) => customer.id !== id)
      );
    } catch (error) {
      console.error("Error deleting customer:", error);
      alert("Could not delete customer.");
    }
  };
  const customerBalances = useMemo(() => {
    const balances: Record<string, CustomerBalanceSummary> = {};
    for (const cust of customers) {
      const custSales = sales.filter(
        (s) =>
          s.customerId === cust.id ||
          (s.customerName && s.customerName.toLowerCase() === (cust.name || "").toLowerCase())
      );
      const custPayments = payments.filter(
        (p) =>
          p.customerId === cust.id ||
          (p.customerName && p.customerName.toLowerCase() === (cust.name || "").toLowerCase())
      );
      balances[cust.id] = reconcileCustomerBalance(custSales, custPayments);
    }
    return balances;
  }, [customers, sales, payments]);

  const overallMetrics = useMemo(() => {
    let totalInvoiced = 0;
    let totalReceived = 0;
    let totalOutstanding = 0;
    for (const b of Object.values(customerBalances)) {
      totalInvoiced += b.totalInvoiced;
      totalReceived += b.totalReceived;
      totalOutstanding += b.totalOutstanding;
    }
    return { totalInvoiced, totalReceived, totalOutstanding };
  }, [customerBalances]);

  const filteredCustomers = customers
    .filter((customer) => {
      const searchText = search.toLowerCase().trim();

      if (!searchText) return true;

      return (
        customer.name.toLowerCase().includes(searchText) ||
        customer.phone.toLowerCase().includes(searchText)
      );
    })
    .sort((a, b) => {
      const comparison = a.name
        .toLowerCase()
        .localeCompare(b.name.toLowerCase());

      return sortOrder === "asc" ? comparison : -comparison;
    });

  return (
    <main className="page-main">
      <header className="site-header">
        <h1 className="text-xl">
          Gaurav Marbles
        </h1>

        <p className="text-muted">
          Customer Management
        </p>
      </header>

      <div className="page-content">
        <div className="mb-6">
          <h2 className="text-2xl">
            Customers
          </h2>

          <p className="text-muted mt-1">
            Manage your customers, track ledger balances, and view sales history
          </p>
        </div>

        {/* Overview Stat Cards */}
        {!loading && customers.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 mb-6">
            <div className="card">
              <span className="text-muted text-xs uppercase font-semibold">Total Customers</span>
              <p className="text-2xl font-bold mt-1">{customers.length}</p>
            </div>

            <div className="card">
              <span className="text-muted text-xs uppercase font-semibold">Total Invoiced</span>
              <p className="text-2xl font-bold mt-1">
                ₹{overallMetrics.totalInvoiced.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className="card">
              <span className="text-xs uppercase font-semibold text-green-700">Total Received</span>
              <p className="text-2xl font-bold text-green-700 mt-1">
                ₹{overallMetrics.totalReceived.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className="card">
              <span className={`text-xs uppercase font-semibold ${overallMetrics.totalOutstanding > 0 ? "text-red-700" : "text-green-700"}`}>
                Total Outstanding
              </span>
              <p
                className="text-2xl font-bold mt-1"
                style={{ color: overallMetrics.totalOutstanding > 0 ? "#dc2626" : "#16a34a" }}
              >
                ₹{overallMetrics.totalOutstanding.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}

        {/* Add Customer */}
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-4">
            Add Customer
          </h3>

          <form
            onSubmit={handleAddCustomer}
            className="grid grid-cols-1 gap-4 md:grid-cols-3"
          >
            <div className="form-field">
              <label>Customer Name</label>

              <input
                type="text"
                placeholder="Enter customer name"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
              />
            </div>

            <div className="form-field">
              <label>Phone Number</label>

              <input
                type="tel"
                placeholder="Enter phone number"
                value={phone}
                onChange={(e) =>
                  setPhone(e.target.value)
                }
              />
            </div>

            <div className="form-field">
              <label>Address</label>

              <input
                type="text"
                placeholder="Enter address"
                value={address}
                onChange={(e) =>
                  setAddress(e.target.value)
                }
              />
            </div>

            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary"
              >
                {saving
                  ? "Adding..."
                  : "+ Add Customer"}
              </button>
            </div>
          </form>
        </div>

        {/* Search & Sort */}
        {!loading && customers.length > 0 && (
          <div className="card mb-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="form-field">
                <label>Search Customer</label>

                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="form-field">
                <label>Sort by Name</label>

                <select
                  value={sortOrder}
                  onChange={(e) =>
                    setSortOrder(e.target.value as "asc" | "desc")
                  }
                >
                  <option value="asc">A → Z</option>
                  <option value="desc">Z → A</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Customer List */}
        {loading ? (
          <div className="card text-center">
            Loading customers...
          </div>
        ) : customers.length === 0 ? (
          <div className="card text-center">
            <div className="text-5xl">
              👤
            </div>

            <h3 className="mt-4 text-lg">
              No customers yet
            </h3>

            <p className="text-muted mt-2">
              Add your first customer above.
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Total Invoiced</th>
                  <th>Total Received</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredCustomers.map((customer) => {
                  const balance = customerBalances[customer.id] || {
                    totalInvoiced: 0,
                    totalReceived: 0,
                    totalOutstanding: 0,
                    totalCredit: 0,
                    overdueAmount: 0,
                    salesCount: 0,
                  };

                  let statusBadgeBg = "#f3f4f6";
                  let statusBadgeColor = "#4b5563";
                  let statusText = "No Sales";

                  if (balance.salesCount > 0) {
                    if (balance.totalOutstanding === 0) {
                      statusBadgeBg = "#dcfce7";
                      statusBadgeColor = "#15803d";
                      statusText = "Cleared";
                    } else if (balance.overdueAmount > 0) {
                      statusBadgeBg = "#fee2e2";
                      statusBadgeColor = "#b91c1c";
                      statusText = "Overdue";
                    } else {
                      statusBadgeBg = "#fef9c3";
                      statusBadgeColor = "#854d0e";
                      statusText = "Payment Due";
                    }
                  }

                  return (
                    <tr key={customer.id}>
                      <td className="font-medium">
                        <button
                          type="button"
                          onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
                          className="hover:underline text-left font-semibold text-blue-600"
                        >
                          {customer.name}
                        </button>
                        {customer.address && (
                          <span className="block text-xs text-muted mt-0.5">{customer.address}</span>
                        )}
                      </td>

                      <td>
                        {customer.phone || "—"}
                      </td>

                      <td className="font-medium">
                        ₹{balance.totalInvoiced.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </td>

                      <td className="font-medium text-green-700">
                        ₹{balance.totalReceived.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </td>

                      <td
                        className="font-bold"
                        style={{ color: balance.totalOutstanding > 0 ? "#dc2626" : "#16a34a" }}
                      >
                        ₹{balance.totalOutstanding.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                        {balance.totalCredit > 0 && (
                          <span className="block text-xs text-blue-600 font-normal">
                            Credit: ₹{balance.totalCredit.toLocaleString("en-IN")}
                          </span>
                        )}
                      </td>

                      <td>
                        <span
                          style={{
                            backgroundColor: statusBadgeBg,
                            color: statusBadgeColor,
                            padding: "3px 8px",
                            borderRadius: "9999px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            display: "inline-block",
                          }}
                        >
                          {statusText}
                        </span>
                      </td>

                      <td>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() =>
                              router.push(`/dashboard/accounts/customer-ledger?partyId=${customer.id}`)
                            }
                            className="text-sm font-medium hover:underline text-indigo-600"
                            title="View Tally-Style Customer Ledger"
                          >
                            Ledger
                          </button>

                          <button
                            onClick={() =>
                              router.push(`/dashboard/customers/${customer.id}`)
                            }
                            className="text-sm font-medium hover:underline text-blue-600"
                          >
                            View
                          </button>

                          <button
                            onClick={() =>
                              router.push(`/dashboard/customers/edit/${customer.id}`)
                            }
                            className="text-sm font-medium hover:underline text-gray-700"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() =>
                              handleDelete(customer.id)
                            }
                            className="text-sm font-medium text-red-600 hover:underline"
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