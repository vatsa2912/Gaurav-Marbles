"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  formatDisplayDate,
  matchesDateFilter,
  compareDatesDesc,
} from "@/lib/dateUtils";

type Expense = {
  id: string;
  title: string;
  category: string;
  amount: number;
  paymentMethod?: string;
  expenseDate: string;
  notes: string;
  createdAt?: unknown;
};

const DEFAULT_CATEGORIES = [
  "Rent",
  "Electricity",
  "Transport",
  "Labour",
  "Maintenance",
  "Office",
  "Marketing",
  "Other",
];

export default function ExpensesPage() {
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Other");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchExpenses = async () => {
      try {
        const snapshot = await getDocs(collection(db, "expenses"));
        if (!isMounted) return;

        const expenseList = snapshot.docs.map((expenseDoc) => {
          const data = expenseDoc.data();
          return {
            id: expenseDoc.id,
            title: data.title || "",
            category: data.category || "Other",
            amount: Number(data.amount) || 0,
            paymentMethod: data.paymentMethod || "Cash",
            expenseDate: data.expenseDate || "",
            notes: data.notes || "",
            createdAt: data.createdAt,
          };
        });

        expenseList.sort((a, b) => compareDatesDesc(a.expenseDate, b.expenseDate));
        setExpenses(expenseList);
      } catch (error) {
        console.error("Error loading expenses:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchExpenses();

    return () => {
      isMounted = false;
    };
  }, [refreshTrigger]);

  const handleAddExpense = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!title.trim()) {
      alert("Expense title is required.");
      return;
    }

    const numericAmount = Number(amount);
    if (!amount.trim() || isNaN(numericAmount) || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      alert("Enter a valid expense amount greater than 0.");
      return;
    }

    if (!expenseDate) {
      alert("Expense date is required.");
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
      setExpenseDate(
        new Date().toISOString().split("T")[0]
      );
      setNotes("");

      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Error adding expense:", error);
      alert("Could not add expense.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this expense?"
    );

    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "expenses", id));

      setExpenses((current) =>
        current.filter((expense) => expense.id !== id)
      );
    } catch (error) {
      console.error("Error deleting expense:", error);
      alert("Could not delete expense.");
    }
  };

  const filteredExpenses = expenses.filter((expense) => {
    const searchText = search.toLowerCase().trim();

    const matchesSearch =
      !searchText ||
      expense.title.toLowerCase().includes(searchText) ||
      expense.category.toLowerCase().includes(searchText) ||
      expense.notes.toLowerCase().includes(searchText);

    const matchesCategory =
      categoryFilter === "All" || expense.category === categoryFilter;

    const matchesDate = matchesDateFilter(expense.expenseDate, dateFilter);

    return (
      matchesSearch &&
      matchesCategory &&
      matchesDate
    );
  });

  const allCategories = Array.from(
    new Set([...DEFAULT_CATEGORIES, ...expenses.map((e) => e.category).filter(Boolean)])
  );

  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + expense.amount,
    0
  );

  const categoryTotals = expenses.reduce(
    (totals, expense) => {
      totals[expense.category] =
        (totals[expense.category] || 0) + expense.amount;

      return totals;
    },
    {} as Record<string, number>
  );

  const currentMonth = new Date().toISOString().slice(0, 7);

  const currentMonthExpenses = expenses
    .filter((expense) =>
      expense.expenseDate.startsWith(currentMonth)
    )
    .reduce(
      (sum, expense) => sum + expense.amount,
      0
    );

  return (
    <main className="page-main">
      <header className="site-header">
        <h1 className="text-xl">
          Gaurav Marbles
        </h1>

        <p className="text-muted">
          Expense Management
        </p>
      </header>

      <div className="page-content">

        <div className="mb-6">
          <h2 className="text-2xl">
            Expenses
          </h2>

          <p className="text-muted mt-1">
            Track business expenses and other costs
          </p>
        </div>

        {/* Add Expense */}

        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-4">
            Add Expense
          </h3>

          <form
            onSubmit={handleAddExpense}
            className="grid grid-cols-1 gap-4 md:grid-cols-3"
          >
            <div className="form-field">
              <label>Expense Title</label>

              <input
                type="text"
                placeholder="e.g. Electricity Bill"
                value={title}
                onChange={(e) =>
                  setTitle(e.target.value)
                }
              />
            </div>

            <div className="form-field">
              <label>Category</label>

              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value)
                }
              >
                <option value="Rent">Rent</option>
                <option value="Electricity">
                  Electricity
                </option>
                <option value="Transport">
                  Transport
                </option>
                <option value="Labour">Labour</option>
                <option value="Maintenance">
                  Maintenance
                </option>
                <option value="Office">
                  Office
                </option>
                <option value="Marketing">
                  Marketing
                </option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-field">
              <label>Amount</label>

              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value)
                }
              />
            </div>

            <div className="form-field">
              <label>Expense Date</label>

              <input
                type="date"
                value={expenseDate}
                onChange={(e) =>
                  setExpenseDate(e.target.value)
                }
              />
            </div>

            <div className="form-field">
              <label>Payment Method</label>

              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value)
                }
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Bank">Bank Transfer</option>
              </select>
            </div>

            <div className="form-field md:col-span-2">
              <label>Notes</label>

              <input
                type="text"
                placeholder="Optional notes"
                value={notes}
                onChange={(e) =>
                  setNotes(e.target.value)
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
                  : "+ Add Expense"}
              </button>
            </div>
          </form>
        </div>

        {/* Total Expenses */}

        <div className="card mb-6">
          <p className="text-muted">
            Total Expenses
          </p>

          <p className="mt-2 text-3xl font-bold">
            ₹
            {totalExpenses.toLocaleString("en-IN", {
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        {/* Expense Summary */}

        <div className="grid grid-cols-1 gap-5 mb-6 md:grid-cols-2">
          <div className="card">
            <p className="text-muted">
              This Month
            </p>

            <p className="mt-2 text-3xl font-bold">
              ₹
              {currentMonthExpenses.toLocaleString("en-IN", {
                maximumFractionDigits: 2,
              })}
            </p>

            <p className="text-muted mt-2">
              Expenses this month
            </p>
          </div>

          <div className="card">
            <p className="text-muted">
              Expense Categories
            </p>

            <p className="mt-2 text-3xl font-bold">
              {Object.keys(categoryTotals).length}
            </p>

            <p className="text-muted mt-2">
              Categories with recorded expenses
            </p>
          </div>
        </div>

        <div className="card mb-6">
          <h3 className="text-lg font-semibold">
            Expenses by Category
          </h3>

          <div className="table-wrapper mt-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Total Amount</th>
                </tr>
              </thead>

              <tbody>
                {Object.entries(categoryTotals)
                  .sort(([, amountA], [, amountB]) => amountB - amountA)
                  .map(([category, amount]) => (
                    <tr key={category}>
                      <td className="font-medium">
                        {category}
                      </td>

                      <td>
                        ₹
                        {amount.toLocaleString("en-IN", {
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expense Filters */}

        <div className="card mb-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

            <div className="form-field">
              <label>Search Expenses</label>

              <input
                type="text"
                placeholder="Search title, category or notes"
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
              />
            </div>

            <div className="form-field">
              <label>Category</label>

              <select
                value={categoryFilter}
                onChange={(e) =>
                  setCategoryFilter(e.target.value)
                }
              >
                <option value="All">All Categories</option>
                {allCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Expense Date</label>

              <input
                type="date"
                value={dateFilter}
                onChange={(e) =>
                  setDateFilter(e.target.value)
                }
              />
            </div>

          </div>

          {(search || categoryFilter !== "All" || dateFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCategoryFilter("All");
                setDateFilter("");
              }}
              className="btn-ghost mt-4"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Expense List */}

        {loading ? (
          <div className="card text-center">
            Loading expenses...
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="card text-center">
            <div className="text-5xl">
              💰
            </div>

            <h3 className="mt-4 text-lg">
              {expenses.length === 0
                ? "No expenses yet"
                : "No expenses match your filters."}
            </h3>

            <p className="text-muted mt-2">
              {expenses.length === 0
                ? "Add your first expense above."
                : "Try changing or clearing your filters."}
            </p>
          </div>
        ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Payment Method</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Notes</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredExpenses.map((expense) => (
                <tr key={expense.id}>
                  <td className="font-medium">
                    {expense.title}
                  </td>

                  <td>{expense.category}</td>

                  <td>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {expense.paymentMethod || "Cash"}
                    </span>
                  </td>

                  <td>
                    {formatDisplayDate(expense.expenseDate)}
                  </td>

                  <td>
                    ₹
                    {expense.amount.toLocaleString(
                      "en-IN",
                      {
                        maximumFractionDigits: 2,
                      }
                    )}
                  </td>

                  <td>
                    {expense.notes || "—"}
                  </td>

                  <td>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() =>
                          router.push(
                            `/dashboard/expenses/${expense.id}`
                          )
                        }
                        className="text-sm font-medium text-emerald-600 hover:underline"
                      >
                        View
                      </button>

                      <button
                        onClick={() =>
                          router.push(
                            `/dashboard/expenses/edit/${expense.id}`
                          )
                        }
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() =>
                          handleDelete(expense.id)
                        }
                        className="text-sm font-medium text-red-600 hover:underline"
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
    </main>
  );
}