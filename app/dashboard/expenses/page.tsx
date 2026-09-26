"use client";

import { useEffect, useState, useMemo } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDisplayDate } from "@/lib/dateUtils";
import { useToast } from "@/components/ui/ToastContext";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  Receipt,
  Plus,
  Search,
  Calendar,
  RotateCcw,
  Eye,
  Edit2,
  Trash2,
  PieChart,
} from "lucide-react";

type Expense = {
  id: string;
  title: string;
  category: string;
  amount: number;
  paymentMethod?: string;
  expenseDate: string;
  notes?: string;
  createdAt?: unknown;
};

const EXPENSE_CATEGORIES = [
  "Rent",
  "Electricity",
  "Labor / Wages",
  "Transport / Freight",
  "Tea & Refreshment",
  "Maintenance",
  "Office Stationery",
  "Marketing / Advertising",
  "Taxes & Legal",
  "Other",
];

export default function ExpensesPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Other");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [expenseDate, setExpenseDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Filter states
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");

  // Deletion modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const fetchExpenses = async () => {
      try {
        setLoading(true);
        const snapshot = await getDocs(collection(db, "expenses"));

        if (!isMounted) return;

        const expenseList = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Expense[];

        setExpenses(expenseList);
      } catch (error) {
        console.error("Error loading expenses:", error);
        showToast("Error loading expenses", "error");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchExpenses();

    return () => {
      isMounted = false;
    };
  }, [refreshTrigger, showToast]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      showToast("Expense title is required", "error");
      return;
    }

    const numericAmount = Number(amount);
    if (!amount.trim() || isNaN(numericAmount) || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      showToast("Enter a valid expense amount greater than 0", "error");
      return;
    }

    if (!expenseDate) {
      showToast("Expense date is required", "error");
      return;
    }

    try {
      setSaving(true);

      await addDoc(collection(db, "expenses"), {
        title: title.trim(),
        category: category.trim() || "Other",
        amount: numericAmount,
        paymentMethod: paymentMethod || "Cash",
        expenseDate,
        notes: notes.trim(),
        createdAt: serverTimestamp(),
      });

      setTitle("");
      setCategory("Other");
      setPaymentMethod("Cash");
      setAmount("");
      setExpenseDate(new Date().toISOString().split("T")[0]);
      setNotes("");
      setShowAddForm(false);
      showToast("Expense logged successfully", "success");
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Error adding expense:", error);
      showToast("Could not add expense", "error");
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = (expense: Expense) => {
    setExpenseToDelete(expense);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!expenseToDelete) return;
    const id = expenseToDelete.id;

    try {
      setDeleting(true);
      await deleteDoc(doc(db, "expenses", id));
      setExpenses((current) => current.filter((e) => e.id !== id));
      showToast("Expense deleted successfully", "success");
      setDeleteModalOpen(false);
    } catch (error) {
      console.error("Error deleting expense:", error);
      showToast("Could not delete expense", "error");
    } finally {
      setDeleting(false);
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((expense) => {
        const searchText = search.toLowerCase().trim();
        const matchesSearch =
          !searchText ||
          expense.title.toLowerCase().includes(searchText) ||
          expense.category.toLowerCase().includes(searchText) ||
          (expense.notes || "").toLowerCase().includes(searchText);

        const matchesCategory =
          categoryFilter === "All" || expense.category === categoryFilter;

        const matchesDate = !dateFilter || expense.expenseDate === dateFilter;

        return matchesSearch && matchesCategory && matchesDate;
      })
      .sort((a, b) => (b.expenseDate || "").localeCompare(a.expenseDate || ""));
  }, [expenses, search, categoryFilter, dateFilter]);

  const totalExpenseAmount = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses]);

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    expenses.forEach((e) => {
      const cat = e.category || "Other";
      totals[cat] = (totals[cat] || 0) + (Number(e.amount) || 0);
    });
    return totals;
  }, [expenses]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Operating Expenses</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track business overheads, labor costs, electricity, freight, and office supplies.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{showAddForm ? "Close Form" : "Record Expense"}</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Expenses Recorded
          </span>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            ₹{totalExpenseAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {expenses.length} expense entry{expenses.length === 1 ? "" : "ies"}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Average Expense Amount
          </span>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            ₹
            {expenses.length > 0
              ? Math.round(totalExpenseAmount / expenses.length).toLocaleString("en-IN")
              : "0"}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Per recorded transaction</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Active Categories
          </span>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {Object.keys(categoryTotals).length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Overhead allocation groups</p>
        </div>
      </div>

      {/* Add Expense Form Card */}
      {showAddForm && (
        <form
          onSubmit={handleAddExpense}
          className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4 animate-fadeIn"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Receipt className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Log Operating Expense
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Expense Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Shop Electricity Bill"
                required
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Amount (₹) *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Expense Date *
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI / GPay</option>
                <option value="Bank">Bank Transfer</option>
                <option value="Credit / Due">Credit / Due</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Notes / Reference (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Paid to Ram Singh via UPI"
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
              {saving ? "Saving Expense..." : "Save Expense"}
            </button>
          </div>
        </form>
      )}

      {/* Filter and Search Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Search Expenses
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search title or notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-slate-50/50 hover:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Filter by Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
            >
              <option value="All">All Categories</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Filter by Date
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
            />
          </div>
        </div>

        {(search || categoryFilter !== "All" || dateFilter) && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCategoryFilter("All");
                setDateFilter("");
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Expenses Table Card */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Loading expenses...
          </p>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Receipt className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No expenses found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {expenses.length === 0
              ? "Record your first operating expense to track shop overheads."
              : "No expenses matched your filter criteria."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mobile Card Feed (block md:hidden) */}
          <div className="block md:hidden space-y-3">
            {filteredExpenses.map((expense) => (
              <div
                key={expense.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/expenses/${expense.id}`}
                      className="font-bold text-slate-900 text-sm hover:text-blue-600 transition block truncate"
                    >
                      {expense.title}
                    </Link>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {expense.category}
                      </span>
                      <span>•</span>
                      <span className="font-mono text-[11px] text-slate-500">{expense.paymentMethod || "Cash"}</span>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                    {formatDisplayDate(expense.expenseDate)}
                  </span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Expense Amount</span>
                  <span className="font-bold text-slate-900 text-base">
                    ₹{Number(expense.amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </span>
                </div>

                {expense.notes && (
                  <p className="text-xs text-slate-500 bg-white p-2 rounded-lg border border-slate-100 italic">
                    "{expense.notes}"
                  </p>
                )}

                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <Link
                    href={`/dashboard/expenses/${expense.id}`}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition inline-flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View</span>
                  </Link>
                  <Link
                    href={`/dashboard/expenses/edit/${expense.id}`}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-800 font-semibold text-xs transition inline-flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => openDeleteModal(expense)}
                    className="py-2.5 px-3.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold text-xs transition inline-flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
                    title="Delete Expense"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table (hidden md:block) */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Payment</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap font-medium">
                      {formatDisplayDate(expense.expenseDate)}
                    </td>

                    <td className="py-3 px-4 font-bold text-slate-900">
                      <Link
                        href={`/dashboard/expenses/${expense.id}`}
                        className="hover:text-blue-600 hover:underline"
                      >
                        {expense.title}
                      </Link>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                        {expense.category}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {expense.paymentMethod || "Cash"}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                      ₹{expense.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </td>

                    <td className="py-3 px-4 text-slate-500 max-w-[200px] truncate">
                      {expense.notes || "—"}
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link
                          href={`/dashboard/expenses/${expense.id}`}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                          title="View Expense Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>

                        <button
                          type="button"
                          onClick={() => router.push(`/dashboard/expenses/edit/${expense.id}`)}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                          title="Edit Expense"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => openDeleteModal(expense)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )}

      {/* Accessible Confirm Modal for Expense Deletion */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Expense"
        message={`Are you sure you want to delete expense "${expenseToDelete?.title}" for ₹${expenseToDelete?.amount}? This action cannot be undone.`}
        confirmText="Delete Expense"
        cancelText="Cancel"
        isDanger={true}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalOpen(false)}
      />
    </div>
  );
}