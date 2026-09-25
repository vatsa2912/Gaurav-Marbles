"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatDisplayDate } from "@/lib/dateUtils";

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

export default function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();

  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadExpense = async () => {
      if (!id) {
        if (isMounted) {
          setError("Invalid expense ID.");
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError("");
        const snap = await getDoc(doc(db, "expenses", id));

        if (!isMounted) return;

        if (!snap.exists()) {
          setError("Expense not found.");
          setExpense(null);
        } else {
          const data = snap.data();
          setExpense({
            id: snap.id,
            title: data.title || "Untitled Expense",
            category: data.category || "Other",
            amount: Number(data.amount) || 0,
            paymentMethod: data.paymentMethod || "Cash",
            expenseDate: data.expenseDate || data.date || "",
            notes: data.notes || "",
            createdAt: data.createdAt,
          });
        }
      } catch (err) {
        console.error("Error loading expense:", err);
        if (isMounted) setError("Failed to load expense details.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadExpense();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleDelete = async () => {
    if (!expense) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete the expense "${expense.title}" of ₹${expense.amount.toLocaleString("en-IN")}?`
    );
    if (!confirmed) return;

    try {
      setDeleting(true);
      await deleteDoc(doc(db, "expenses", id));
      router.push("/dashboard/expenses");
    } catch (err) {
      console.error("Error deleting expense:", err);
      alert(err instanceof Error ? err.message : "Could not delete expense.");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <main className="page-main">
        <header className="site-header">
          <h1 className="text-xl">Gaurav Marbles</h1>
          <p className="text-muted">Expense Details</p>
        </header>
        <div className="page-content-narrow">
          <div className="card text-center py-12">
            <div className="w-8 h-8 border-4 border-gray-300 border-t-black rounded-full animate-spin mx-auto mb-3" />
            <p className="text-muted text-sm">Loading expense details...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !expense) {
    return (
      <main className="page-main">
        <header className="site-header">
          <h1 className="text-xl">Gaurav Marbles</h1>
          <p className="text-muted">Expense Details</p>
        </header>
        <div className="page-content-narrow">
          <button
            type="button"
            onClick={() => router.push("/dashboard/expenses")}
            className="btn-ghost"
          >
            ← Back to Expenses
          </button>
          <div className="card mt-6 text-center py-12">
            <h2 className="text-xl font-bold text-gray-900">
              {error || "Expense not found"}
            </h2>
            <p className="text-muted mt-2 text-sm">
              This expense record does not exist or may have been removed.
            </p>
            <Link
              href="/dashboard/expenses"
              className="btn-primary mt-5 inline-block"
            >
              Return to Expenses List
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-main">
      <header className="site-header">
        <h1 className="text-xl">Gaurav Marbles</h1>
        <p className="text-muted">Expense Details</p>
      </header>

      <div className="page-content-narrow">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => router.push("/dashboard/expenses")}
              className="btn-ghost"
            >
              ← Back to Expenses
            </button>
            <div className="flex items-center gap-3 mt-3">
              <h2 className="text-2xl font-bold text-gray-900">{expense.title}</h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800">
                {expense.category}
              </span>
            </div>
            <p className="text-muted text-sm mt-1">
              Expense Date: <span className="font-semibold text-gray-800">{formatDisplayDate(expense.expenseDate)}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/expenses/edit/${expense.id}`}
              className="btn-secondary text-sm"
            >
              Edit Expense
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="btn-primary text-sm bg-red-600 hover:bg-red-700"
              style={{ background: "#dc2626" }}
            >
              {deleting ? "Deleting..." : "Delete Expense"}
            </button>
          </div>
        </div>

        {/* Primary Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="card p-5 border-l-4 border-l-red-600">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Total Amount
            </span>
            <div className="mt-2 text-2xl font-bold text-red-600">
              ₹{expense.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="card p-5 border-l-4 border-l-blue-600">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Payment Method
            </span>
            <div className="mt-2 text-xl font-bold text-gray-800">
              {expense.paymentMethod || "Cash"}
            </div>
          </div>

          <div className="card p-5 border-l-4 border-l-gray-600">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Category
            </span>
            <div className="mt-2 text-xl font-bold text-gray-800">
              {expense.category}
            </div>
          </div>
        </div>

        {/* Detailed Info Card */}
        <div className="card p-6 space-y-4">
          <h3 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2">
            Expense Record Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs text-muted block">Expense Title / Description</span>
              <span className="font-medium text-gray-900">{expense.title}</span>
            </div>

            <div>
              <span className="text-xs text-muted block">Transaction Date</span>
              <span className="font-medium text-gray-900">
                {formatDisplayDate(expense.expenseDate)}
              </span>
            </div>

            <div>
              <span className="text-xs text-muted block">Payment Method</span>
              <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800">
                {expense.paymentMethod || "Cash"}
              </span>
            </div>

            <div>
              <span className="text-xs text-muted block">Record ID</span>
              <span className="font-mono text-xs text-gray-500">{expense.id}</span>
            </div>
          </div>

          <div>
            <span className="text-xs text-muted block mb-1">Additional Notes</span>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm text-gray-700 min-h-[50px]">
              {expense.notes ? expense.notes : <span className="text-muted italic">No notes provided.</span>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
