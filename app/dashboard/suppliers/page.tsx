"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Party } from "@/lib/ledgerTypes";
import { getParties } from "@/lib/ledgerService";
import { formatLedgerAmount } from "@/lib/ledgerTypes";
import {
  Truck,
  Plus,
  Search,
  Building2,
  Phone,
  MapPin,
  Eye,
  BookOpen,
  ArrowRight,
} from "lucide-react";

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Suppliers Directory</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Vendor accounts, purchase orders history, and Tally-style supplier ledgers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/accounts/parties"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition shadow-xs"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Parties Master</span>
          </Link>

          <Link
            href="/dashboard/purchases/add"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Purchase</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search suppliers by name, phone, city, or GSTIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-slate-50/50 hover:bg-white"
          />
        </div>
      </div>

      {/* Suppliers Table Card */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Loading supplier directory...
          </p>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Truck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No suppliers found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? "No suppliers matched your search query."
              : "Register your suppliers in All Parties Master or create your first purchase."}
          </p>
          <Link
            href="/dashboard/accounts/parties"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
          >
            <span>Open Parties Master</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mobile Card Feed (block md:hidden) */}
          <div className="block md:hidden space-y-3">
            {filteredSuppliers.map((s) => (
              <div
                key={s.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/suppliers/${s.id}`}
                      className="font-bold text-slate-900 text-sm hover:text-blue-600 transition block truncate"
                    >
                      {s.name}
                    </Link>
                    {s.gstin && (
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        GSTIN: {s.gstin}
                      </div>
                    )}
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    {s.status || "Active"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Location</span>
                    <span className="text-slate-700 font-medium truncate block">
                      {[s.city, s.state].filter(Boolean).join(", ") || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Contact</span>
                    <span className="text-slate-800 font-mono font-medium block">
                      {s.phone || "—"}
                    </span>
                  </div>
                  <div className="col-span-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Opening Balance</span>
                    <span className="font-bold text-slate-900">
                      ₹{formatLedgerAmount(s.openingBalance || 0)} <span className="text-[10px] font-normal text-slate-500">({s.openingBalanceType || "Credit"})</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <Link
                    href={`/dashboard/suppliers/${s.id}`}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition inline-flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Profile</span>
                  </Link>
                  <Link
                    href={`/dashboard/accounts/supplier-ledger?party=${encodeURIComponent(s.id || s.name)}`}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold text-xs transition inline-flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Ledger</span>
                  </Link>
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
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4 text-right">Opening Balance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSuppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4">
                      <Link
                        href={`/dashboard/suppliers/${s.id}`}
                        className="font-bold text-slate-900 hover:text-blue-600 transition"
                      >
                        {s.name}
                      </Link>
                      {s.gstin && (
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          GSTIN: {s.gstin}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-700">
                      {(s.city || s.state) ? (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{[s.city, s.state].filter(Boolean).join(", ")}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-700 font-mono">
                      {s.phone ? (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{s.phone}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-medium text-slate-800">
                      ₹{formatLedgerAmount(s.openingBalance || 0)}{" "}
                      <span className="text-[10px] text-slate-400">({s.openingBalanceType || "Credit"})</span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {s.status || "Active"}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/dashboard/suppliers/${s.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-[11px] transition"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </Link>

                        <Link
                          href={`/dashboard/accounts/supplier-ledger?party=${encodeURIComponent(s.id || s.name)}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold text-[11px] transition"
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>Ledger</span>
                        </Link>
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
    </div>
  );
}
