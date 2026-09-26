"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatDisplayDate, extractTransactionDate, getTodayDateString } from "@/lib/dateUtils";
import { useToast } from "@/components/ui/ToastContext";

type DailySale = {
  id: string;
  saleNumber: number | string;
  customerName: string;
  totalAmount: number;
  paymentMethod?: string;
  cashAmount?: number;
  upiAmount?: number;
  bankAmount?: number;
  creditAmount?: number;
  receivedAmount?: number;
  paidAmount?: number;
  saleDate: string;
};

type DailyPurchase = {
  id: string;
  purchaseNumber: number | string;
  supplierName: string;
  totalAmount: number;
  paymentMethod?: string;
  cashAmount?: number;
  upiAmount?: number;
  bankAmount?: number;
  creditAmount?: number;
  paidAmount?: number;
  dueAmount?: number;
  purchaseDate: string;
};

type DailyExpense = {
  id: string;
  title: string;
  category: string;
  amount: number;
  paymentMethod?: string;
  expenseDate: string;
  notes?: string;
};

type DailyPayment = {
  id: string;
  customerName: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  saleId?: string;
  notes?: string;
};

export default function DailyMaintainPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const [openingCash, setOpeningCash] = useState<string>("0");
  const [openingCashSaved, setOpeningCashSaved] = useState<boolean>(false);
  const [savingCash, setSavingCash] = useState(false);

  // Data states
  const [sales, setSales] = useState<DailySale[]>([]);
  const [purchases, setPurchases] = useState<DailyPurchase[]>([]);
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [directPayments, setDirectPayments] = useState<DailyPayment[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Add Expense state
  const [expTitle, setExpTitle] = useState("");
  const [expCategory, setExpCategory] = useState("Other");
  const [expAmount, setExpAmount] = useState("");
  const [expMethod, setExpMethod] = useState("Cash");
  const [expNotes, setExpNotes] = useState("");
  const [addingExp, setAddingExp] = useState(false);

  // Active view tab: "cash" | "sales" | "purchases" | "expenses"
  const [activeTab, setActiveTab] = useState<"cash" | "sales" | "purchases" | "expenses">("cash");

  // Load opening cash and daily transactions whenever selectedDate changes
  useEffect(() => {
    let isMounted = true;

    const loadDayData = async () => {
      try {
        setLoading(true);

        // 1. Fetch Opening Cash for selectedDate
        const cashDocRef = doc(db, "dailyCash", selectedDate);
        const cashDocSnap = await getDoc(cashDocRef);
        if (!isMounted) return;

        if (cashDocSnap.exists()) {
          setOpeningCash(String(cashDocSnap.data().openingCash ?? 0));
          setOpeningCashSaved(true);
        } else {
          setOpeningCash("0");
          setOpeningCashSaved(false);
        }

        // 2. Fetch Sales for selectedDate using extractTransactionDate
        const salesSnap = await getDocs(collection(db, "sales"));
        const salesList: DailySale[] = salesSnap.docs
          .map((d) => {
            const data = d.data();
            const dateStr = extractTransactionDate(data, "saleDate");
            return {
              id: d.id,
              saleNumber: data.saleNumber ?? d.id,
              customerName: data.customerName ?? "Walk-in Customer",
              totalAmount: Number(data.totalAmount) || 0,
              paymentMethod: data.paymentMethod,
              cashAmount: data.cashAmount !== undefined ? Number(data.cashAmount) : undefined,
              upiAmount: data.upiAmount !== undefined ? Number(data.upiAmount) : undefined,
              bankAmount: data.bankAmount !== undefined ? Number(data.bankAmount) : undefined,
              creditAmount: data.creditAmount !== undefined ? Number(data.creditAmount) : undefined,
              receivedAmount: Number(data.receivedAmount ?? data.paidAmount ?? 0),
              paidAmount: Number(data.paidAmount ?? data.receivedAmount ?? 0),
              saleDate: dateStr,
            };
          })
          .filter((s) => s.saleDate === selectedDate);
        if (isMounted) setSales(salesList);

        // 3. Fetch Purchases for selectedDate using extractTransactionDate
        const purchasesSnap = await getDocs(collection(db, "purchases"));
        const purchasesList: DailyPurchase[] = purchasesSnap.docs
          .map((d) => {
            const data = d.data();
            const dateStr = extractTransactionDate(data, "purchaseDate");
            return {
              id: d.id,
              purchaseNumber: data.purchaseNumber ?? d.id,
              supplierName: data.supplierName ?? "Supplier",
              totalAmount: Number(data.totalAmount) || 0,
              paymentMethod: data.paymentMethod,
              cashAmount: data.cashAmount !== undefined ? Number(data.cashAmount) : undefined,
              upiAmount: data.upiAmount !== undefined ? Number(data.upiAmount) : undefined,
              bankAmount: data.bankAmount !== undefined ? Number(data.bankAmount) : undefined,
              creditAmount: data.creditAmount !== undefined ? Number(data.creditAmount) : undefined,
              paidAmount: Number(data.paidAmount ?? 0),
              dueAmount: Number(data.dueAmount ?? 0),
              purchaseDate: dateStr,
            };
          })
          .filter((p) => p.purchaseDate === selectedDate);
        if (isMounted) setPurchases(purchasesList);

        // 4. Fetch Expenses for selectedDate using extractTransactionDate
        const expensesSnap = await getDocs(collection(db, "expenses"));
        const expensesList: DailyExpense[] = expensesSnap.docs
          .map((d) => {
            const data = d.data();
            const dateStr = extractTransactionDate(data, "expenseDate");
            return {
              id: d.id,
              title: data.title || "Expense",
              category: data.category || "Other",
              amount: Number(data.amount) || 0,
              paymentMethod: data.paymentMethod || "Cash",
              expenseDate: dateStr,
              notes: data.notes || "",
            };
          })
          .filter((e) => e.expenseDate === selectedDate);
        if (isMounted) setExpenses(expensesList);

        // 5. Fetch Direct Customer Payments for selectedDate using extractTransactionDate
        const paymentsSnap = await getDocs(collection(db, "payments"));
        const paymentsList: DailyPayment[] = paymentsSnap.docs
          .map((d) => {
            const data = d.data();
            const dateStr = extractTransactionDate(data, "paymentDate");
            return {
              id: d.id,
              customerName: data.customerName || "Customer",
              amount: Number(data.amount) || 0,
              paymentMethod: data.paymentMethod || "Cash",
              paymentDate: dateStr,
              saleId: data.saleId,
              notes: data.notes || "",
            };
          })
          .filter((pm) => pm.paymentDate === selectedDate);
        if (isMounted) setDirectPayments(paymentsList);

      } catch (err) {
        console.error("Error loading daily financial data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDayData();

    return () => {
      isMounted = false;
    };
  }, [selectedDate]);

  // Date navigation helpers
  const changeDay = (deltaDays: number) => {
    const parts = selectedDate.split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + deltaDays);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleSaveOpeningCash = async () => {
    try {
      setSavingCash(true);
      const num = Number(openingCash) || 0;
      await setDoc(doc(db, "dailyCash", selectedDate), {
        date: selectedDate,
        openingCash: num,
        updatedAt: serverTimestamp(),
      });
      setOpeningCashSaved(true);
      showToast(`Opening cash for ${selectedDate} saved: ₹${num.toLocaleString("en-IN")}`, "success");
    } catch (err) {
      console.error("Error saving opening cash:", err);
      showToast("Failed to save opening cash.", "error");
    } finally {
      setSavingCash(false);
    }
  };

  // Quick Add Expense handler
  const handleQuickAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim()) {
      showToast("Expense title is required.", "error");
      return;
    }
    const num = Number(expAmount);
    if (!expAmount || isNaN(num) || num <= 0) {
      showToast("Please enter a valid expense amount greater than 0.", "error");
      return;
    }

    try {
      setAddingExp(true);
      const docRef = await addDoc(collection(db, "expenses"), {
        title: expTitle.trim(),
        category: expCategory.trim() || "Other",
        amount: num,
        paymentMethod: expMethod || "Cash",
        expenseDate: selectedDate,
        notes: expNotes.trim(),
        createdAt: serverTimestamp(),
      });

      // Add to local state immediately
      setExpenses((prev) => [
        ...prev,
        {
          id: docRef.id,
          title: expTitle.trim(),
          category: expCategory.trim() || "Other",
          amount: num,
          paymentMethod: expMethod || "Cash",
          expenseDate: selectedDate,
          notes: expNotes.trim(),
        },
      ]);

      showToast("Expense added successfully.", "success");
      setExpTitle("");
      setExpAmount("");
      setExpNotes("");
      setExpCategory("Other");
      setExpMethod("Cash");
    } catch (err) {
      console.error("Error adding expense:", err);
      showToast("Could not add expense.", "error");
    } finally {
      setAddingExp(false);
    }
  };

  // ── Financial Calculations ──────────────────────────────────────────────────
  const calculations = useMemo(() => {
    const opening = Number(openingCash) || 0;

    // 1. CASH MOVEMENTS
    let cashFromSales = 0;
    let upiFromSales = 0;
    let bankFromSales = 0;
    let creditFromSales = 0;

    sales.forEach((s) => {
      if (s.paymentMethod === "Split") {
        cashFromSales += s.cashAmount || 0;
        upiFromSales += s.upiAmount || 0;
        bankFromSales += s.bankAmount || 0;
        creditFromSales += s.creditAmount || 0;
      } else if (s.paymentMethod === "UPI") {
        upiFromSales += s.receivedAmount || 0;
        creditFromSales += Math.max(0, s.totalAmount - (s.receivedAmount || 0));
      } else if (s.paymentMethod === "Bank") {
        bankFromSales += s.receivedAmount || 0;
        creditFromSales += Math.max(0, s.totalAmount - (s.receivedAmount || 0));
      } else if (s.paymentMethod === "Credit / Due") {
        creditFromSales += s.totalAmount;
      } else {
        // Default or "Cash"
        cashFromSales += s.receivedAmount || 0;
        creditFromSales += Math.max(0, s.totalAmount - (s.receivedAmount || 0));
      }
    });

    // Direct customer payments received today (avoid double-counting if linked to a sale created today)
    let directCashIn = 0;
    let directUpiIn = 0;
    let directBankIn = 0;

    directPayments.forEach((p) => {
      // If payment is linked to a sale created today, it's already accounted for in s.receivedAmount
      const isSaleToday = p.saleId && sales.some((s) => s.id === p.saleId);
      if (isSaleToday) return;

      if (p.paymentMethod === "UPI") directUpiIn += p.amount;
      else if (p.paymentMethod === "Bank") directBankIn += p.amount;
      else directCashIn += p.amount;
    });

    // 2. PURCHASES MOVEMENTS
    let cashToPurchases = 0;
    let upiToPurchases = 0;
    let bankToPurchases = 0;
    let creditToPurchases = 0;

    purchases.forEach((p) => {
      if (p.paymentMethod === "Split") {
        cashToPurchases += p.cashAmount || 0;
        upiToPurchases += p.upiAmount || 0;
        bankToPurchases += p.bankAmount || 0;
        creditToPurchases += p.creditAmount || 0;
      } else if (p.paymentMethod === "UPI") {
        upiToPurchases += p.paidAmount || p.totalAmount;
        creditToPurchases += p.dueAmount || 0;
      } else if (p.paymentMethod === "Bank") {
        bankToPurchases += p.paidAmount || p.totalAmount;
        creditToPurchases += p.dueAmount || 0;
      } else if (p.paymentMethod === "Credit / Due") {
        creditToPurchases += p.totalAmount;
      } else {
        // Default or "Cash"
        cashToPurchases += p.paidAmount !== undefined ? p.paidAmount : p.totalAmount;
        creditToPurchases += p.dueAmount || 0;
      }
    });

    // 3. EXPENSES MOVEMENTS
    let cashToExpenses = 0;
    let upiToExpenses = 0;
    let bankToExpenses = 0;

    expenses.forEach((e) => {
      if (e.paymentMethod === "UPI") upiToExpenses += e.amount;
      else if (e.paymentMethod === "Bank") bankToExpenses += e.amount;
      else cashToExpenses += e.amount;
    });

    // Totals
    const totalCashIn = cashFromSales + directCashIn;
    const totalCashOut = cashToPurchases + cashToExpenses;
    const expectedClosingCash = opening + totalCashIn - totalCashOut;

    const netUpi = upiFromSales + directUpiIn - upiToPurchases - upiToExpenses;
    const netBank = bankFromSales + directBankIn - bankToPurchases - bankToExpenses;

    const totalSalesAmount = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalPurchasesAmount = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
    const totalExpensesAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

    return {
      opening,
      cashFromSales,
      directCashIn,
      totalCashIn,
      cashToPurchases,
      cashToExpenses,
      totalCashOut,
      expectedClosingCash,
      upiFromSales,
      directUpiIn,
      upiToPurchases,
      upiToExpenses,
      netUpi,
      bankFromSales,
      directBankIn,
      bankToPurchases,
      bankToExpenses,
      netBank,
      creditFromSales,
      creditToPurchases,
      totalSalesAmount,
      totalPurchasesAmount,
      totalExpensesAmount,
    };
  }, [openingCash, sales, purchases, expenses, directPayments]);

  const getSaleCash = (s: DailySale): number => {
    if (s.cashAmount !== undefined && s.cashAmount !== null) return s.cashAmount;
    if (s.paymentMethod === "Cash") return s.receivedAmount || 0;
    return 0;
  };

  const getPurchaseCash = (p: DailyPurchase): number => {
    if (p.cashAmount !== undefined && p.cashAmount !== null) return p.cashAmount;
    if (p.paymentMethod === "Cash") return p.paidAmount || 0;
    return 0;
  };

  return (
    <main className="page-main">
      <header className="site-header">
        <h1 className="text-xl">Gaurav Marbles</h1>
        <p className="text-muted">Daily Financial Maintain Register</p>
      </header>

      <div className="page-content space-y-6">
        {/* Navigation & Date Selection Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Daily Financial Register</h2>
            <p className="text-muted text-sm mt-0.5">
              Track daily opening cash, real cash-in/cash-out, UPI, Bank, and credit movement.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => changeDay(-1)}
              className="btn-secondary px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm"
              title="Previous Day"
            >
              ← Prev Day
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="font-semibold text-xs sm:text-sm border border-gray-300 rounded-lg px-2.5 sm:px-3 py-1.5 min-w-[130px]"
            />
            <button
              type="button"
              onClick={() => changeDay(1)}
              className="btn-secondary px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm"
              title="Next Day"
            >
              Next Day →
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(getTodayDateString())}
              className="btn-ghost text-xs text-blue-600 font-semibold hover:underline px-2 py-1"
            >
              Today
            </button>
          </div>
        </div>

        {/* Date Banner & Opening Cash Card */}
        <div className="card p-5 bg-gradient-to-r from-blue-50/50 via-white to-gray-50 border border-blue-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                Financial Date
              </span>
              <h3 className="text-xl font-bold text-gray-900 mt-0.5">
                {formatDisplayDate(selectedDate)}
              </h3>
              <p className="text-xs text-muted mt-1">
                {sales.length} Sales · {purchases.length} Purchases · {expenses.length} Expenses recorded
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5 sm:gap-3 w-full sm:w-auto">
              <div className="form-field mb-0 w-full sm:w-auto">
                <label className="text-xs font-semibold text-gray-700">
                  Opening Cash for Day (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={openingCash}
                  onChange={(e) => {
                    setOpeningCash(e.target.value);
                    setOpeningCashSaved(false);
                  }}
                  className="w-full sm:w-36 font-bold text-base"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveOpeningCash}
                disabled={savingCash}
                className="btn-primary py-2.5 sm:py-2 text-sm w-full sm:w-auto text-center justify-center"
              >
                {savingCash ? "Saving..." : openingCashSaved ? "✓ Saved" : "Save Opening Cash"}
              </button>
            </div>
          </div>
        </div>

        {/* 4 Key KPI Financial Summaries */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Cash Register Box */}
          <div className="card p-5 border-l-4 border-l-emerald-600 bg-white">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              💵 Physical Cash Register
            </span>
            <div className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Opening Cash:</span>
                <span className="font-semibold text-gray-900">
                  ₹{calculations.opening.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>+ Cash Inflow (Sales):</span>
                <span>+₹{calculations.totalCashIn.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-red-600 font-medium">
                <span>- Cash Purchases:</span>
                <span>-₹{calculations.cashToPurchases.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-red-600 font-medium">
                <span>- Cash Expenses:</span>
                <span>-₹{calculations.cashToExpenses.toLocaleString("en-IN")}</span>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-gray-200 flex items-baseline justify-between">
              <span className="text-xs font-bold text-gray-700">Expected Closing:</span>
              <span className="text-xl font-bold text-emerald-700">
                ₹{calculations.expectedClosingCash.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* 2. UPI Digital Box */}
          <div className="card p-5 border-l-4 border-l-blue-600 bg-white">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-800">
              📱 UPI / QR Digital
            </span>
            <div className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>+ UPI Sales Received:</span>
                <span>+₹{(calculations.upiFromSales + calculations.directUpiIn).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-red-600 font-medium">
                <span>- UPI Purchases Paid:</span>
                <span>-₹{calculations.upiToPurchases.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-red-600 font-medium">
                <span>- UPI Expenses Paid:</span>
                <span>-₹{calculations.upiToExpenses.toLocaleString("en-IN")}</span>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-gray-200 flex items-baseline justify-between">
              <span className="text-xs font-bold text-gray-700">Net UPI Flow:</span>
              <span className={`text-xl font-bold ${calculations.netUpi >= 0 ? "text-blue-700" : "text-red-600"}`}>
                {calculations.netUpi >= 0 ? "+" : ""}₹{calculations.netUpi.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* 3. Bank Account Box */}
          <div className="card p-5 border-l-4 border-l-purple-600 bg-white">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-800">
              🏦 Bank (NEFT / RTGS)
            </span>
            <div className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>+ Bank Sales Received:</span>
                <span>+₹{(calculations.bankFromSales + calculations.directBankIn).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-red-600 font-medium">
                <span>- Bank Purchases:</span>
                <span>-₹{calculations.bankToPurchases.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-red-600 font-medium">
                <span>- Bank Expenses:</span>
                <span>-₹{calculations.bankToExpenses.toLocaleString("en-IN")}</span>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-gray-200 flex items-baseline justify-between">
              <span className="text-xs font-bold text-gray-700">Net Bank Flow:</span>
              <span className={`text-xl font-bold ${calculations.netBank >= 0 ? "text-purple-700" : "text-red-600"}`}>
                {calculations.netBank >= 0 ? "+" : ""}₹{calculations.netBank.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* 4. Credit / Due Movement Box */}
          <div className="card p-5 border-l-4 border-l-amber-600 bg-white">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
              ⏳ Credit / Due Movement
            </span>
            <div className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between text-amber-800 font-medium">
                <span>New Customer Credit:</span>
                <span>₹{calculations.creditFromSales.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-gray-700 font-medium">
                <span>New Supplier Payables:</span>
                <span>₹{calculations.creditToPurchases.toLocaleString("en-IN")}</span>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-gray-200 flex items-baseline justify-between">
              <span className="text-xs font-bold text-gray-700">Net Due Created:</span>
              <span className="text-xl font-bold text-amber-700">
                ₹{(calculations.creditFromSales - calculations.creditToPurchases).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Inline Add Expense Form */}
        <div className="card p-5 bg-gray-50 border border-gray-200">
          <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                ⚡ Quick Record Expense for {formatDisplayDate(selectedDate)}
              </h3>
              <p className="text-xs text-muted">
                Record incidental shop expenses (tea, loading, transport, repair) directly into today&apos;s register
              </p>
            </div>
          </div>

          <form onSubmit={handleQuickAddExpense} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
            <div className="form-field sm:col-span-1">
              <label className="text-xs font-semibold">Expense Title *</label>
              <input
                type="text"
                value={expTitle}
                onChange={(e) => setExpTitle(e.target.value)}
                placeholder="e.g. Labor / Tea"
                required
              />
            </div>
            <div className="form-field">
              <label className="text-xs font-semibold">Category</label>
              <select
                value={expCategory}
                onChange={(e) => setExpCategory(e.target.value)}
              >
                <option value="Labour">Labour</option>
                <option value="Transport">Transport</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Electricity">Electricity</option>
                <option value="Office">Office / Tea</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-field">
              <label className="text-xs font-semibold">Amount (₹) *</label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                placeholder="₹ Amount"
                required
              />
            </div>
            <div className="form-field">
              <label className="text-xs font-semibold">Paid Via</label>
              <select
                value={expMethod}
                onChange={(e) => setExpMethod(e.target.value)}
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Bank">Bank</option>
              </select>
            </div>
            <div>
              <button
                type="submit"
                disabled={addingExp}
                className="btn-primary w-full py-2 text-xs font-semibold"
              >
                {addingExp ? "Recording..." : "+ Add Expense"}
              </button>
            </div>
          </form>
        </div>

        {/* Transaction Tabs & Details Tables */}
        <div className="card p-6">
          <div className="flex border-b border-gray-200 gap-6 mb-4">
            <button
              type="button"
              onClick={() => setActiveTab("cash")}
              className={`pb-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "cash"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Cash Ledger Log
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("sales")}
              className={`pb-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "sales"
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Sales Today ({sales.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("purchases")}
              className={`pb-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "purchases"
                  ? "border-purple-600 text-purple-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Purchases Today ({purchases.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("expenses")}
              className={`pb-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "expenses"
                  ? "border-red-600 text-red-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Expenses Today ({expenses.length})
            </button>
          </div>

          {loading ? (
            <p className="text-muted text-sm py-6 text-center">Loading today&apos;s records...</p>
          ) : activeTab === "cash" ? (
            /* CASH LEDGER LOG */
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="data-table w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left font-medium">Type</th>
                      <th className="text-left font-medium">Description / Party</th>
                      <th className="text-center font-medium">Mode</th>
                      <th className="text-right font-medium">Inflow (₹)</th>
                      <th className="text-right font-medium">Outflow (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-gray-50 font-semibold">
                      <td className="text-gray-600">Opening</td>
                      <td>Opening Physical Cash in Drawer</td>
                      <td className="text-center">Cash</td>
                      <td className="text-right text-emerald-700">
                        ₹{calculations.opening.toLocaleString("en-IN")}
                      </td>
                      <td className="text-right text-muted">—</td>
                    </tr>

                    {/* Sales with Cash */}
                    {sales
                      .filter((s) => getSaleCash(s) > 0)
                      .map((s) => {
                        const cashVal = getSaleCash(s);
                        return (
                          <tr key={`sale-${s.id}`}>
                            <td>
                              <Link
                                href={`/dashboard/sales/${s.id}`}
                                className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 hover:underline inline-block"
                                title="View Sale Details"
                              >
                                Sale #{s.saleNumber}
                              </Link>
                            </td>
                            <td>{s.customerName}</td>
                            <td className="text-center text-xs text-gray-500">
                              {s.paymentMethod || "Cash"}
                            </td>
                            <td className="text-right font-semibold text-emerald-700">
                              ₹{cashVal.toLocaleString("en-IN")}
                            </td>
                            <td className="text-right text-muted">—</td>
                          </tr>
                        );
                      })}

                    {/* Direct Cash Payments */}
                    {directPayments
                      .filter((p) => p.paymentMethod === "Cash" && (!p.saleId || !sales.some((s) => s.id === p.saleId)))
                      .map((p) => (
                        <tr key={`pay-${p.id}`}>
                          <td>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                              Customer Payment
                            </span>
                          </td>
                          <td>{p.customerName} {p.notes ? `(${p.notes})` : ""}</td>
                          <td className="text-center text-xs text-gray-500">Cash</td>
                          <td className="text-right font-semibold text-emerald-700">
                            ₹{p.amount.toLocaleString("en-IN")}
                          </td>
                          <td className="text-right text-muted">—</td>
                        </tr>
                      ))}

                    {/* Purchases with Cash */}
                    {purchases
                      .filter((p) => getPurchaseCash(p) > 0)
                      .map((p) => {
                        const cashVal = getPurchaseCash(p);
                        return (
                          <tr key={`pur-${p.id}`}>
                            <td>
                              <Link
                                href={`/dashboard/purchases/${p.id}`}
                                className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-800 hover:underline inline-block"
                                title="View Purchase Details"
                              >
                                Purchase #{p.purchaseNumber}
                              </Link>
                            </td>
                            <td>{p.supplierName}</td>
                            <td className="text-center text-xs text-gray-500">
                              {p.paymentMethod || "Cash"}
                            </td>
                            <td className="text-right text-muted">—</td>
                            <td className="text-right font-semibold text-red-600">
                              ₹{cashVal.toLocaleString("en-IN")}
                            </td>
                          </tr>
                        );
                      })}

                    {/* Expenses with Cash */}
                    {expenses
                      .filter((e) => (e.paymentMethod || "Cash") === "Cash")
                      .map((e) => (
                        <tr key={`exp-${e.id}`}>
                          <td>
                            <Link
                              href={`/dashboard/expenses/${e.id}`}
                              className="text-xs font-semibold px-2 py-0.5 rounded bg-red-100 text-red-800 hover:underline inline-block"
                              title="View Expense Details"
                            >
                              Expense ({e.category})
                            </Link>
                          </td>
                          <td>{e.title} {e.notes ? `— ${e.notes}` : ""}</td>
                          <td className="text-center text-xs text-gray-500">Cash</td>
                          <td className="text-right text-muted">—</td>
                          <td className="text-right font-semibold text-red-600">
                            ₹{e.amount.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-50 font-bold border-t-2 border-emerald-300">
                      <td colSpan={3} className="py-2.5">
                        Closing Cash Balance in Drawer
                      </td>
                      <td colSpan={2} className="text-right py-2.5 text-lg text-emerald-800">
                        ₹{calculations.expectedClosingCash.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : activeTab === "sales" ? (
            /* SALES TODAY TABLE */
            <div className="overflow-x-auto">
              {sales.length === 0 ? (
                <p className="text-muted text-sm py-4 text-center">No sales recorded on this date.</p>
              ) : (
                <table className="data-table w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left font-medium">Sale #</th>
                      <th className="text-left font-medium">Customer</th>
                      <th className="text-center font-medium">Payment Method</th>
                      <th className="text-right font-medium">Total (₹)</th>
                      <th className="text-right font-medium">Cash (₹)</th>
                      <th className="text-right font-medium">UPI (₹)</th>
                      <th className="text-right font-medium">Bank (₹)</th>
                      <th className="text-right font-medium">Credit / Due (₹)</th>
                      <th className="text-center font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((s) => {
                      const isSplit = s.paymentMethod === "Split";
                      const cash = isSplit ? s.cashAmount || 0 : s.paymentMethod === "Cash" ? s.receivedAmount || 0 : 0;
                      const upi = isSplit ? s.upiAmount || 0 : s.paymentMethod === "UPI" ? s.receivedAmount || 0 : 0;
                      const bank = isSplit ? s.bankAmount || 0 : s.paymentMethod === "Bank" ? s.receivedAmount || 0 : 0;
                      const credit = isSplit ? s.creditAmount || 0 : Math.max(0, s.totalAmount - (s.receivedAmount || 0));

                      return (
                        <tr key={s.id}>
                          <td>
                            <Link
                              href={`/dashboard/sales/${s.id}`}
                              className="font-semibold text-blue-600 hover:underline"
                              title="View Sale Details"
                            >
                              #{s.saleNumber}
                            </Link>
                          </td>
                          <td className="font-medium text-gray-800">{s.customerName}</td>
                          <td className="text-center">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                              {s.paymentMethod || "Cash"}
                            </span>
                          </td>
                          <td className="text-right font-bold text-gray-900">
                            ₹{s.totalAmount.toLocaleString("en-IN")}
                          </td>
                          <td className="text-right text-emerald-700">
                            {cash > 0 ? `₹${cash.toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="text-right text-blue-700">
                            {upi > 0 ? `₹${upi.toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="text-right text-purple-700">
                            {bank > 0 ? `₹${bank.toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="text-right text-amber-700 font-semibold">
                            {credit > 0 ? `₹${credit.toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="text-center">
                            <Link
                              href={`/dashboard/sales/${s.id}`}
                              className="btn-secondary text-xs px-2.5 py-1"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                      <td colSpan={3}>Total ({sales.length} sales)</td>
                      <td className="text-right">₹{calculations.totalSalesAmount.toLocaleString("en-IN")}</td>
                      <td className="text-right text-emerald-700">₹{calculations.cashFromSales.toLocaleString("en-IN")}</td>
                      <td className="text-right text-blue-700">₹{calculations.upiFromSales.toLocaleString("en-IN")}</td>
                      <td className="text-right text-purple-700">₹{calculations.bankFromSales.toLocaleString("en-IN")}</td>
                      <td className="text-right text-amber-700">₹{calculations.creditFromSales.toLocaleString("en-IN")}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          ) : activeTab === "purchases" ? (
            /* PURCHASES TODAY TABLE */
            <div className="overflow-x-auto">
              {purchases.length === 0 ? (
                <p className="text-muted text-sm py-4 text-center">No purchases recorded on this date.</p>
              ) : (
                <table className="data-table w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left font-medium">Purchase #</th>
                      <th className="text-left font-medium">Supplier</th>
                      <th className="text-center font-medium">Payment Method</th>
                      <th className="text-right font-medium">Total (₹)</th>
                      <th className="text-right font-medium">Cash (₹)</th>
                      <th className="text-right font-medium">UPI (₹)</th>
                      <th className="text-right font-medium">Bank (₹)</th>
                      <th className="text-right font-medium">Credit / Due (₹)</th>
                      <th className="text-center font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((p) => {
                      const isSplit = p.paymentMethod === "Split";
                      const cash = isSplit ? p.cashAmount || 0 : p.paymentMethod === "Cash" ? p.paidAmount || p.totalAmount : 0;
                      const upi = isSplit ? p.upiAmount || 0 : p.paymentMethod === "UPI" ? p.paidAmount || p.totalAmount : 0;
                      const bank = isSplit ? p.bankAmount || 0 : p.paymentMethod === "Bank" ? p.paidAmount || p.totalAmount : 0;
                      const credit = isSplit ? p.creditAmount || 0 : p.paymentMethod === "Credit / Due" ? p.totalAmount : p.dueAmount || 0;

                      return (
                        <tr key={p.id}>
                          <td>
                            <Link
                              href={`/dashboard/purchases/${p.id}`}
                              className="font-semibold text-purple-600 hover:underline"
                              title="View Purchase Details"
                            >
                              #{p.purchaseNumber}
                            </Link>
                          </td>
                          <td className="font-medium text-gray-800">{p.supplierName}</td>
                          <td className="text-center">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                              {p.paymentMethod || "Cash"}
                            </span>
                          </td>
                          <td className="text-right font-bold text-gray-900">
                            ₹{p.totalAmount.toLocaleString("en-IN")}
                          </td>
                          <td className="text-right text-red-600">
                            {cash > 0 ? `₹${cash.toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="text-right text-blue-700">
                            {upi > 0 ? `₹${upi.toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="text-right text-purple-700">
                            {bank > 0 ? `₹${bank.toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="text-right text-amber-700 font-semibold">
                            {credit > 0 ? `₹${credit.toLocaleString("en-IN")}` : "—"}
                          </td>
                          <td className="text-center">
                            <Link
                              href={`/dashboard/purchases/${p.id}`}
                              className="btn-secondary text-xs px-2.5 py-1"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                      <td colSpan={3}>Total ({purchases.length} purchases)</td>
                      <td className="text-right">₹{calculations.totalPurchasesAmount.toLocaleString("en-IN")}</td>
                      <td className="text-right text-red-600">₹{calculations.cashToPurchases.toLocaleString("en-IN")}</td>
                      <td className="text-right text-blue-700">₹{calculations.upiToPurchases.toLocaleString("en-IN")}</td>
                      <td className="text-right text-purple-700">₹{calculations.bankToPurchases.toLocaleString("en-IN")}</td>
                      <td className="text-right text-amber-700">₹{calculations.creditToPurchases.toLocaleString("en-IN")}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          ) : (
            /* EXPENSES TODAY TABLE */
            <div className="overflow-x-auto">
              {expenses.length === 0 ? (
                <p className="text-muted text-sm py-4 text-center">No expenses recorded on this date.</p>
              ) : (
                <table className="data-table w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left font-medium">Expense Title</th>
                      <th className="text-left font-medium">Category</th>
                      <th className="text-center font-medium">Payment Mode</th>
                      <th className="text-left font-medium">Notes</th>
                      <th className="text-right font-medium">Amount (₹)</th>
                      <th className="text-center font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id}>
                        <td className="font-semibold text-gray-900">
                          <Link
                            href={`/dashboard/expenses/${e.id}`}
                            className="hover:text-blue-600 hover:underline"
                            title="View Expense Details"
                          >
                            {e.title}
                          </Link>
                        </td>
                        <td>
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                            {e.category}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-800">
                            {e.paymentMethod || "Cash"}
                          </span>
                        </td>
                        <td className="text-gray-500 text-xs">{e.notes || "—"}</td>
                        <td className="text-right font-bold text-red-600">
                          ₹{e.amount.toLocaleString("en-IN")}
                        </td>
                        <td className="text-center">
                          <Link
                            href={`/dashboard/expenses/${e.id}`}
                            className="btn-secondary text-xs px-2.5 py-1"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                      <td colSpan={4}>Total Expenses ({expenses.length})</td>
                      <td className="text-right text-red-600">
                        ₹{calculations.totalExpensesAmount.toLocaleString("en-IN")}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
