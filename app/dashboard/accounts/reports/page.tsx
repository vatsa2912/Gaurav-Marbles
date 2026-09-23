"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatLedgerAmount } from "@/lib/ledgerTypes";
import { reconcileCustomerBalance, type CustomerSale, type CustomerPaymentRecord } from "@/lib/customerBalance";
import { getParties } from "@/lib/ledgerService";

interface DebtorSummary {
  id: string;
  name: string;
  phone: string;
  city: string;
  totalInvoiced: number;
  totalReceived: number;
  outstanding: number;
  credit: number;
}

interface CreditorSummary {
  id: string;
  name: string;
  phone: string;
  city: string;
  totalPurchased: number;
  totalPaid: number;
  outstandingPayable: number;
}

export default function LedgerReportsPage() {
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState<"DEBTORS" | "CREDITORS">("DEBTORS");
  const [debtors, setDebtors] = useState<DebtorSummary[]>([]);
  const [creditors, setCreditors] = useState<CreditorSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let isMounted = true;
    const generateReports = async () => {
      try {
        setLoading(true);

        const [parties, salesSnap, purchSnap, paymentsSnap] = await Promise.all([
          getParties(),
          getDocs(collection(db, "sales")),
          getDocs(collection(db, "purchases")),
          getDocs(collection(db, "payments")),
        ]);

        if (!isMounted) return;

        // 1. Process Debtors (Customers)
        const allSales = salesSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as (CustomerSale & { id: string; items?: unknown[] })[];

        const allPayments = paymentsSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as (CustomerPaymentRecord & { id: string })[];

        const customerParties = parties.filter(
          (p) => p.type === "Customer" || p.type === "Both"
        );

        const debtorList: DebtorSummary[] = customerParties.map((party) => {
          const pName = party.name.toLowerCase().trim();

          const partySales = allSales.filter((s) => {
            const matchId = party.id && s.customerId === party.id;
            const matchName = s.customerName && s.customerName.toLowerCase().trim() === pName;
            return matchId || matchName;
          });

          const partyPayments = allPayments.filter((p) => {
            const matchId = party.id && p.customerId === party.id;
            const matchName = p.customerName && p.customerName.toLowerCase().trim() === pName;
            return matchId || matchName;
          });

          const balance = reconcileCustomerBalance(partySales, partyPayments);
          const openingDr = party.openingBalanceType === "Debit" ? (party.openingBalance || 0) : 0;
          const openingCr = party.openingBalanceType === "Credit" ? (party.openingBalance || 0) : 0;

          const totalInv = balance.totalInvoiced + openingDr;
          const totalRec = balance.totalPaid + openingCr;
          const netOutstanding = Math.max(0, totalInv - totalRec);
          const netCredit = Math.max(0, totalRec - totalInv);

          return {
            id: party.id,
            name: party.name,
            phone: party.phone || "",
            city: party.city || "",
            totalInvoiced: totalInv,
            totalReceived: totalRec,
            outstanding: netOutstanding,
            credit: netCredit,
          };
        });

        // Sort debtors by highest outstanding first
        debtorList.sort((a, b) => b.outstanding - a.outstanding);
        setDebtors(debtorList);

        // 2. Process Creditors (Suppliers)
        const allPurchases = purchSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as {
          id: string;
          supplierName?: string;
          totalAmount?: number;
        }[];

        const supplierParties = parties.filter(
          (p) => p.type === "Supplier" || p.type === "Both"
        );

        const creditorList: CreditorSummary[] = supplierParties.map((party) => {
          const pName = party.name.toLowerCase().trim();

          const partyPurchases = allPurchases.filter(
            (p) => (p.supplierName || "").toLowerCase().trim() === pName
          );

          const totalPurchased = partyPurchases.reduce(
            (sum, p) => sum + (Number(p.totalAmount) || 0),
            0
          );

          // Payments made to supplier
          const supplierPayments = allPayments.filter((pay) => {
            const cName = ((pay as { supplierName?: string }).supplierName || pay.customerName || "")
              .toLowerCase()
              .trim();
            return cName === pName;
          });

          const totalPaid = supplierPayments.reduce(
            (sum, pay) => sum + (Number(pay.amount) || 0),
            0
          );

          const openingCr = party.openingBalanceType === "Credit" ? (party.openingBalance || 0) : 0;
          const openingDr = party.openingBalanceType === "Debit" ? (party.openingBalance || 0) : 0;

          const totalPayable = totalPurchased + openingCr;
          const totalSettled = totalPaid + openingDr;
          const netPayable = Math.max(0, totalPayable - totalSettled);

          return {
            id: party.id || party.name,
            name: party.name,
            phone: party.phone || "",
            city: party.city || "",
            totalPurchased: totalPayable,
            totalPaid: totalSettled,
            outstandingPayable: netPayable,
          };
        });

        // Sort creditors by highest payable first
        creditorList.sort((a, b) => b.outstandingPayable - a.outstandingPayable);
        setCreditors(creditorList);
      } catch (err) {
        console.error("Error generating ledger reports:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    generateReports();

    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered lists
  const filteredDebtors = debtors.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      d.name.toLowerCase().includes(q) ||
      d.phone.toLowerCase().includes(q) ||
      d.city.toLowerCase().includes(q)
    );
  });

  const filteredCreditors = creditors.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q)
    );
  });

  // Aggregate totals
  const totalDebtorReceivable = debtors.reduce((sum, d) => sum + d.outstanding, 0);
  const totalCreditorPayable = creditors.reduce((sum, c) => sum + c.outstandingPayable, 0);
  const totalCustomerCredits = debtors.reduce((sum, d) => sum + d.credit, 0);

  return (
    <main className="page-main">
      <header className="site-header no-print">
        <h1 className="text-xl font-bold">Gaurav Marbles</h1>
        <p className="text-muted">Accounts · Ledger & Balance Reports</p>
      </header>

      <div className="page-content">
        {/* Navigation Breadcrumb & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 no-print">
          <div>
            <div className="flex items-center gap-2 text-xs">
              <Link href="/dashboard" className="text-muted hover:underline">
                Dashboard
              </Link>
              <span className="text-gray-400">/</span>
              <span className="text-gray-800 font-semibold">Accounts</span>
              <span className="text-gray-400">/</span>
              <span className="text-gray-800 font-semibold">Ledger Reports</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">
              Outstanding Balances & Ledger Summary
            </h2>
            <p className="text-muted text-sm">
              Comprehensive overview of receivables (Debtors) and payables (Creditors)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-secondary text-xs inline-flex items-center gap-1.5"
            >
              <span>🖨️</span> Print Summary
            </button>
          </div>
        </div>

        {/* High-Level Financial Position Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="card border-l-4 border-l-emerald-600 p-5">
            <div className="text-xs font-semibold uppercase text-emerald-800 tracking-wider">
              Total Sundry Debtors (Receivables)
            </div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">
              ₹{formatLedgerAmount(totalDebtorReceivable)}
            </div>
            <div className="text-xs text-muted mt-1">
              Across {debtors.filter((d) => d.outstanding > 0).length} parties with pending dues
            </div>
          </div>

          <div className="card border-l-4 border-l-indigo-600 p-5">
            <div className="text-xs font-semibold uppercase text-indigo-800 tracking-wider">
              Total Sundry Creditors (Payables)
            </div>
            <div className="text-2xl font-bold text-indigo-700 mt-1">
              ₹{formatLedgerAmount(totalCreditorPayable)}
            </div>
            <div className="text-xs text-muted mt-1">
              Across {creditors.filter((c) => c.outstandingPayable > 0).length} suppliers to settle
            </div>
          </div>

          <div className="card border-l-4 border-l-blue-600 p-5">
            <div className="text-xs font-semibold uppercase text-blue-800 tracking-wider">
              Net Liquidity Position
            </div>
            <div
              className={`text-2xl font-bold mt-1 ${
                totalDebtorReceivable - totalCreditorPayable >= 0
                  ? "text-blue-700"
                  : "text-red-700"
              }`}
            >
              ₹{formatLedgerAmount(Math.abs(totalDebtorReceivable - totalCreditorPayable))}
              <span className="text-xs ml-1 font-semibold">
                {totalDebtorReceivable - totalCreditorPayable >= 0 ? "Surplus (Dr)" : "Deficit (Cr)"}
              </span>
            </div>
            <div className="text-xs text-muted mt-1">
              Customer Credits (Advance): ₹{formatLedgerAmount(totalCustomerCredits)}
            </div>
          </div>
        </div>

        {/* Tabs & Search Controls */}
        <div className="card mb-6 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReportType("DEBTORS")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  reportType === "DEBTORS"
                    ? "bg-gray-900 text-white shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Sundry Debtors ({debtors.length})
              </button>

              <button
                type="button"
                onClick={() => setReportType("CREDITORS")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                  reportType === "CREDITORS"
                    ? "bg-gray-900 text-white shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Sundry Creditors ({creditors.length})
              </button>
            </div>

            <div className="w-full sm:w-72">
              <input
                type="text"
                placeholder="Search party by name, phone, or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs"
              />
            </div>
          </div>
        </div>

        {/* Report Content Table */}
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            {reportType === "DEBTORS" ? (
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Customer Party</th>
                    <th className="py-3 px-4">City</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4 text-right">Total Invoiced</th>
                    <th className="py-3 px-4 text-right">Total Received</th>
                    <th className="py-3 px-4 text-right">Outstanding (Dr)</th>
                    <th className="py-3 px-4 text-right">Advance (Cr)</th>
                    <th className="py-3 px-4 text-right no-print">Tally Ledger</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted">
                        <div className="w-6 h-6 border-2 border-gray-400 border-t-black rounded-full animate-spin mx-auto mb-2" />
                        Compiling debtors report...
                      </td>
                    </tr>
                  ) : filteredDebtors.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-muted">
                        No debtor records found.
                      </td>
                    </tr>
                  ) : (
                    filteredDebtors.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50 transition">
                        <td className="py-3 px-4 font-semibold text-gray-900">{d.name}</td>
                        <td className="py-3 px-4 text-xs text-gray-600">{d.city || "—"}</td>
                        <td className="py-3 px-4 text-xs font-mono text-gray-600">{d.phone || "—"}</td>
                        <td className="py-3 px-4 text-right font-mono text-xs">
                          ₹{formatLedgerAmount(d.totalInvoiced)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs">
                          ₹{formatLedgerAmount(d.totalReceived)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                          {d.outstanding > 0 ? `₹${formatLedgerAmount(d.outstanding)}` : "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-blue-700">
                          {d.credit > 0 ? `₹${formatLedgerAmount(d.credit)}` : "—"}
                        </td>
                        <td className="py-3 px-4 text-right no-print">
                          <Link
                            href={`/dashboard/accounts/customer-ledger?partyId=${encodeURIComponent(
                              d.id
                            )}`}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
                          >
                            View Ledger ↗
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Supplier Party</th>
                    <th className="py-3 px-4">City</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4 text-right">Total Purchases</th>
                    <th className="py-3 px-4 text-right">Total Paid</th>
                    <th className="py-3 px-4 text-right">Outstanding Payable (Cr)</th>
                    <th className="py-3 px-4 text-right no-print">Tally Ledger</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted">
                        <div className="w-6 h-6 border-2 border-gray-400 border-t-black rounded-full animate-spin mx-auto mb-2" />
                        Compiling creditors report...
                      </td>
                    </tr>
                  ) : filteredCreditors.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-muted">
                        No supplier creditor records found.
                      </td>
                    </tr>
                  ) : (
                    filteredCreditors.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50 transition">
                        <td className="py-3 px-4 font-semibold text-gray-900">{c.name}</td>
                        <td className="py-3 px-4 text-xs text-gray-600">{c.city || "—"}</td>
                        <td className="py-3 px-4 text-xs font-mono text-gray-600">{c.phone || "—"}</td>
                        <td className="py-3 px-4 text-right font-mono text-xs">
                          ₹{formatLedgerAmount(c.totalPurchased)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs">
                          ₹{formatLedgerAmount(c.totalPaid)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-indigo-700">
                          {c.outstandingPayable > 0
                            ? `₹${formatLedgerAmount(c.outstandingPayable)}`
                            : "—"}
                        </td>
                        <td className="py-3 px-4 text-right no-print">
                          <Link
                            href={`/dashboard/accounts/supplier-ledger?party=${encodeURIComponent(
                              c.id
                            )}`}
                            className="text-xs font-semibold text-purple-600 hover:text-purple-800 underline"
                          >
                            View Ledger ↗
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
