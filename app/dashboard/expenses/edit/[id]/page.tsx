"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ui/ToastContext";

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

export default function EditExpensePage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();

  const expenseId = params.id as string;

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Other");
  const [availableCategories, setAvailableCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadExpense = async () => {
      try {
        const expenseRef = doc(
          db,
          "expenses",
          expenseId
        );

        const expenseSnap = await getDoc(expenseRef);

        if (!expenseSnap.exists()) {
          showToast("Expense not found.", "error");
          router.push("/dashboard/expenses");
          return;
        }

        const data = expenseSnap.data();

        if (isMounted) {
          setTitle(data.title || "");
          const cat = data.category || "Other";
          setCategory(cat);
          setAvailableCategories((prev) =>
            prev.includes(cat) ? prev : [...prev, cat]
          );
          setAmount(
            data.amount !== undefined
              ? String(data.amount)
              : ""
          );
          setExpenseDate(data.expenseDate || "");
          setNotes(data.notes || "");
        }
      } catch (error) {
        console.error(
          "Error loading expense:",
          error
        );
        showToast("Could not load expense.", "error");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (expenseId) {
      loadExpense();
    }
    return () => {
      isMounted = false;
    };
  }, [expenseId, router, showToast]);

  const handleSave = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!title.trim()) {
      showToast("Expense title is required.", "error");
      return;
    }

    const numericAmount = Number(amount);

    if (!amount.trim() || isNaN(numericAmount) || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      showToast("Please enter a valid expense amount greater than 0.", "error");
      return;
    }

    if (!expenseDate) {
      showToast("Expense date is required.", "error");
      return;
    }

    try {
      setSaving(true);

      const expenseRef = doc(
        db,
        "expenses",
        expenseId
      );

      await updateDoc(expenseRef, {
        title: title.trim(),
        category,
        amount: numericAmount,
        expenseDate,
        notes: notes.trim(),
      });

      showToast("Expense updated successfully.", "success");
      router.push("/dashboard/expenses");
    } catch (error) {
      console.error(
        "Error updating expense:",
        error
      );
      showToast("Could not update expense.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="page-main">
        <div className="page-content">
          <p>Loading expense...</p>
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
          Expense Management
        </p>
      </header>

      <div className="page-content">

        <div className="mb-6">
          <h2 className="text-2xl">
            Edit Expense
          </h2>

          <p className="text-muted mt-1">
            Update expense details
          </p>
        </div>

        <div className="card">
          <form
            onSubmit={handleSave}
            className="grid grid-cols-1 gap-4 md:grid-cols-3"
          >
            <div className="form-field">
              <label>Expense Title</label>

              <input
                type="text"
                placeholder="Enter expense title"
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
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
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

            <div className="md:col-span-3 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary"
              >
                {saving
                  ? "Saving..."
                  : "Save Changes"}
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/dashboard/expenses"
                  )
                }
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

      </div>
    </main>
  );
}