"use client";

import { useEffect, useState, useMemo } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  reconcileCustomerBalance,
  type CustomerSaleRecord,
  type CustomerPaymentRecord,
  type CustomerBalanceSummary,
} from "@/lib/customerBalance";
import { useToast } from "@/components/ui/ToastContext";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  Users,
  UserPlus,
  Search,
  Phone,
  MapPin,
  Eye,
  Edit2,
  Trash2,
  BookOpen,
} from "lucide-react";

type Customer = {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  createdAt?: unknown;
};

export default function CustomersPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<CustomerSaleRecord[]>([]);
  const [payments, setPayments] = useState<CustomerPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Filter & sort
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Deletion modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const fetchCustomersData = async () => {
      try {
        setLoading(true);

        const [customersSnapshot, salesSnapshot, paymentsSnapshot] =
          await Promise.all([
            getDocs(collection(db, "customers")),
            getDocs(collection(db, "sales")),
            getDocs(collection(db, "customerPayments")),
          ]);

        if (!isMounted) return;

        const customerList = customersSnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Customer[];

        const salesList = salesSnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as CustomerSaleRecord[];

        const paymentsList = paymentsSnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as CustomerPaymentRecord[];

        setCustomers(customerList);
        setSales(salesList);
        setPayments(paymentsList);
      } catch (error) {
        console.error("Error loading customers:", error);
        showToast("Error loading customers", "error");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCustomersData();

    return () => {
      isMounted = false;
    };
  }, [refreshTrigger, showToast]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast("Customer name is required", "error");
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
      setShowAddForm(false);
      showToast(`Customer "${name.trim()}" added successfully`, "success");
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Error adding customer:", error);
      showToast("Could not add customer. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = (customer: Customer) => {
    setCustomerToDelete(customer);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete) return;
    const id = customerToDelete.id;

    try {
      setDeleting(true);

      // Check whether this customer has any sales
      const salesQuery = query(collection(db, "sales"), where("customerId", "==", id));
      const salesSnapshot = await getDocs(salesQuery);

      if (!salesSnapshot.empty) {
        showToast(
          "Cannot delete customer: Existing sales records are linked to this customer.",
          "error"
        );
        setDeleteModalOpen(false);
        return;
      }

      await deleteDoc(doc(db, "customers", id));
      setCustomers((current) => current.filter((c) => c.id !== id));
      showToast("Customer deleted successfully", "success");
      setDeleteModalOpen(false);
    } catch (error) {
      console.error("Error deleting customer:", error);
      showToast("Could not delete customer.", "error");
    } finally {
      setDeleting(false);
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

  const filteredCustomers = customers
    .filter((customer) => {
      const queryStr = search.toLowerCase();
      return (
        customer.name.toLowerCase().includes(queryStr) ||
        (customer.phone && customer.phone.toLowerCase().includes(queryStr))
      );
    })
    .sort((a, b) => {
      if (sortOrder === "asc") {
        return a.name.localeCompare(b.name);
      }
      return b.name.localeCompare(a.name);
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Customer Directory</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage customer profiles, dispatch contacts, and reconciled ledger balances.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition self-start sm:self-auto cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>{showAddForm ? "Close Form" : "Add Customer"}</span>
        </button>
      </div>

      {/* Add Customer Card */}
      {showAddForm && (
        <form
          onSubmit={handleAddCustomer}
          className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4 animate-fadeIn"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <UserPlus className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Register New Customer
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rajesh Sharma"
                required
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Address / City
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Civil Lines, Jaipur"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Saving Customer..." : "Save Customer"}
            </button>
          </div>
        </form>
      )}

      {/* Filter and Search Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Search Customers
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-slate-50/50 hover:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Sort by Name
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
            >
              <option value="asc">Alphabetical (A → Z)</option>
              <option value="desc">Alphabetical (Z → A)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customers Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Loading customers & ledger balances...
          </p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No customers found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {search ? "No customer profiles match your search query." : "Register your first customer above."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mobile Card Feed (block md:hidden) */}
          <div className="block md:hidden space-y-3">
            {filteredCustomers.map((customer) => {
              const balance = customerBalances[customer.id] || {
                totalInvoiced: 0,
                totalReceived: 0,
                totalOutstanding: 0,
                totalCredit: 0,
                overdueAmount: 0,
                salesCount: 0,
              };

              let statusBadge = (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                  No Sales
                </span>
              );

              if (balance.salesCount > 0) {
                if (balance.totalOutstanding === 0) {
                  statusBadge = (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Cleared
                    </span>
                  );
                } else if (balance.overdueAmount > 0) {
                  statusBadge = (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      Overdue
                    </span>
                  );
                } else {
                  statusBadge = (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      Payment Due
                    </span>
                  );
                }
              }

              return (
                <div
                  key={customer.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/customers/${customer.id}`}
                        className="font-bold text-slate-900 text-sm hover:text-blue-600 transition block truncate"
                      >
                        {customer.name}
                      </Link>
                      {customer.phone && (
                        <div className="text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{customer.phone}</span>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">{statusBadge}</div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Invoiced</span>
                      <span className="font-bold text-slate-800 text-xs">
                        ₹{balance.totalInvoiced.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Received</span>
                      <span className="font-bold text-emerald-700 text-xs">
                        ₹{balance.totalReceived.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Due</span>
                      <span className="font-bold text-slate-900 text-xs">
                        ₹{balance.totalOutstanding.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <Link
                      href={`/dashboard/customers/${customer.id}`}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition inline-flex items-center justify-center gap-1.5 min-h-[44px]"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </Link>
                    <Link
                      href={`/dashboard/accounts/customer-ledger?party=${encodeURIComponent(customer.name)}`}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold text-xs transition inline-flex items-center justify-center gap-1.5 min-h-[44px]"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Ledger</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => openDeleteModal(customer)}
                      className="py-2.5 px-3.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold text-xs transition inline-flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
                      title="Delete Customer"
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
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4 text-right">Total Invoiced</th>
                  <th className="py-3 px-4 text-right">Total Received</th>
                  <th className="py-3 px-4 text-right">Outstanding Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((customer) => {
                  const balance = customerBalances[customer.id] || {
                    totalInvoiced: 0,
                    totalReceived: 0,
                    totalOutstanding: 0,
                    totalCredit: 0,
                    overdueAmount: 0,
                    salesCount: 0,
                  };

                  let statusBadge = (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                      No Sales
                    </span>
                  );

                  if (balance.salesCount > 0) {
                    if (balance.totalOutstanding === 0) {
                      statusBadge = (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Cleared
                        </span>
                      );
                    } else if (balance.overdueAmount > 0) {
                      statusBadge = (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Overdue
                        </span>
                      );
                    } else {
                      statusBadge = (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Payment Due
                        </span>
                      );
                    }
                  }

                  return (
                    <tr key={customer.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <Link
                          href={`/dashboard/customers/${customer.id}`}
                          className="font-bold text-slate-900 hover:text-blue-600 transition"
                        >
                          {customer.name}
                        </Link>
                        {customer.address && (
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{customer.address}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-700 font-mono">
                        {customer.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{customer.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-medium text-slate-800">
                        ₹{balance.totalInvoiced.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-3 px-4 text-right font-semibold text-emerald-700">
                        ₹{balance.totalReceived.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        ₹{balance.totalOutstanding.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </td>

                      <td className="py-3 px-4 text-center">{statusBadge}</td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/dashboard/customers/${customer.id}`}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                            title="View Customer Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          <Link
                            href={`/dashboard/accounts/customer-ledger?party=${encodeURIComponent(customer.name)}`}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-purple-600 hover:bg-purple-50 transition"
                            title="View Tally-Style Customer Ledger"
                          >
                            <BookOpen className="w-4 h-4" />
                          </Link>

                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/customers/edit/${customer.id}`)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="Edit Customer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => openDeleteModal(customer)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Delete Customer"
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

      {/* Accessible Confirm Modal for Customer Deletion */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Customer"
        message={`Are you sure you want to delete customer "${customerToDelete?.name}"? Deletion is safely prevented if this customer has historical invoices.`}
        confirmText="Delete Customer"
        cancelText="Cancel"
        isDanger={true}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalOpen(false)}
      />
    </div>
  );
}