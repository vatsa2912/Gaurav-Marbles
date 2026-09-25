"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Party } from "@/lib/ledgerTypes";
import { getParties } from "@/lib/ledgerService";
import { formatLedgerAmount } from "@/lib/ledgerTypes";

export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let isMounted = true;
    getParties()
      .then((list) => {
        if (!isMounted) return;
        const supps = list.filter((p) => p.type === "Supplier" || p.type === "Both");
        setSuppliers(supps);
      })
      .catch((err) => console.error("Error loading suppliers:", err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredSuppliers = suppliers.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.phone || "").toLowerCase().includes(q) ||
      (s.city || "").toLowerCase().includes(q) ||
      (s.gstin || "").toLowerCase().includes(q)
    );
  });

  return (
    <main className="page-main">
      <header className="site-header">
        <h1 className="text-xl">Gaurav Marbles</h1>
        <p className="text-muted">Supplier Directory</p>
      </header>

      <div className="page-content space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Suppliers</h2>
            <p className="text-muted text-sm mt-0.5">
              Manage your suppliers, track purchase history, and view ledgers
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/accounts/parties"
              className="btn-secondary text-sm inline-flex items-center gap-1.5"
            >
              All Parties Master
            </Link>
            <Link
              href="/dashboard/purchases/add"
              className="btn-primary text-sm inline-flex items-center gap-1.5"
            >
              + Add Purchase
            </Link>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="card p-4">
          <input
            type="text"
            placeholder="Search suppliers by name, phone, city, or GSTIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm"
          />
        </div>

        {/* Suppliers Table */}
        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-muted">
              <div className="w-8 h-8 border-4 border-gray-300 border-t-black rounded-full animate-spin mx-auto mb-3" />
              Loading suppliers...
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="py-12 text-center text-muted">
              No suppliers found.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left font-medium">Supplier</th>
                    <th className="text-left font-medium">Location</th>
                    <th className="text-left font-medium">Contact</th>
                    <th className="text-right font-medium">Opening Balance</th>
                    <th className="text-center font-medium">Status</th>
                    <th className="text-center font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => router.push(`/dashboard/suppliers/${s.id}`)}
                          className="font-semibold text-left text-blue-600 hover:underline"
                        >
                          {s.name}
                        </button>
                        {s.gstin && (
                          <span className="block text-[11px] font-mono text-gray-500">
                            GST: {s.gstin}
                          </span>
                        )}
                      </td>
                      <td className="text-gray-600 text-xs">
                        {s.city || "—"}{s.state ? `, ${s.state}` : ""}
                      </td>
                      <td className="font-mono text-xs text-gray-700">
                        {s.phone || "—"}
                      </td>
                      <td className="text-right font-mono font-medium">
                        ₹{formatLedgerAmount(s.openingBalance || 0)}{" "}
                        <span className="text-[10px] text-muted">({s.openingBalanceType || "Credit"})</span>
                      </td>
                      <td className="text-center">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          {s.status || "Active"}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/suppliers/${s.id}`)}
                            className="text-xs font-semibold text-emerald-600 hover:underline"
                          >
                            View
                          </button>
                          <Link
                            href={`/dashboard/accounts/supplier-ledger?party=${encodeURIComponent(s.id || s.name)}`}
                            className="text-xs font-semibold text-purple-600 hover:underline"
                          >
                            Ledger ↗
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
