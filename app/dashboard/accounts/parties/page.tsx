"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type Party, type PartyType } from "@/lib/ledgerTypes";
import { getParties, deleteParty } from "@/lib/ledgerService";
import { formatLedgerAmount } from "@/lib/ledgerTypes";
import PartyModal from "@/components/ledger/PartyModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastContext";

export default function PartiesPage() {
  const { showToast } = useToast();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "Customer" | "Supplier">("ALL");
  const [statusFilter] = useState<"ALL" | "Active" | "Inactive">("ALL");

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [defaultModalType, setDefaultModalType] = useState<PartyType>("Customer");

  // Deletion feedback & modal
  const [actionError, setActionError] = useState("");
  const [partyToDelete, setPartyToDelete] = useState<Party | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeletingParty, setIsDeletingParty] = useState(false);

  const reloadParties = async () => {
    try {
      setActionError("");
      const list = await getParties();
      setParties(list);
    } catch (err) {
      console.error("Error loading parties:", err);
      setActionError("Failed to reload parties.");
    }
  };

  useEffect(() => {
    let isMounted = true;
    getParties()
      .then((list) => {
        if (isMounted) {
          setParties(list);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error loading parties:", err);
        if (isMounted) {
          setActionError("Failed to load parties. Please refresh.");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter parties
  const filteredParties = parties.filter((p) => {
    if (typeFilter !== "ALL") {
      if (p.type !== typeFilter && p.type !== "Both") return false;
    }
    if (statusFilter !== "ALL") {
      if ((p.status || "Active") !== statusFilter) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = p.name.toLowerCase().includes(q);
      const matchPhone = (p.phone || "").toLowerCase().includes(q);
      const matchCity = (p.city || "").toLowerCase().includes(q);
      const matchGstin = (p.gstin || "").toLowerCase().includes(q);
      return matchName || matchPhone || matchCity || matchGstin;
    }
    return true;
  });

  // Calculate high-level totals
  const totalCustomers = parties.filter((p) => p.type === "Customer" || p.type === "Both").length;
  const totalSuppliers = parties.filter((p) => p.type === "Supplier" || p.type === "Both").length;
  const totalOpeningDebit = parties
    .filter((p) => p.openingBalanceType === "Debit")
    .reduce((sum, p) => sum + (p.openingBalance || 0), 0);
  const totalOpeningCredit = parties
    .filter((p) => p.openingBalanceType === "Credit")
    .reduce((sum, p) => sum + (p.openingBalance || 0), 0);

  const handleDeleteClick = (party: Party) => {
    setPartyToDelete(party);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!partyToDelete) return;
    try {
      setIsDeletingParty(true);
      setActionError("");
      await deleteParty(partyToDelete.id, partyToDelete.name);
      showToast(`Party "${partyToDelete.name}" deleted successfully.`, "success");
      setDeleteModalOpen(false);
      setPartyToDelete(null);
      await reloadParties();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to delete party.";
      showToast(errorMsg, "error");
      setActionError(errorMsg);
    } finally {
      setIsDeletingParty(false);
    }
  };

  const handleOpenAdd = (type: PartyType = "Customer") => {
    setEditingParty(null);
    setDefaultModalType(type);
    setModalOpen(true);
  };

  const handleOpenEdit = (party: Party) => {
    setEditingParty(party);
    setDefaultModalType(party.type);
    setModalOpen(true);
  };

  return (
    <main className="page-main">
      <header className="site-header no-print">
        <h1 className="text-xl font-bold">Gaurav Marbles</h1>
        <p className="text-muted">Accounts · Party Master Directory</p>
      </header>

      <div className="page-content">
        {/* Navigation Breadcrumbs & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs">
              <Link href="/dashboard" className="text-muted hover:underline">
                Dashboard
              </Link>
              <span className="text-gray-400">/</span>
              <span className="text-gray-800 font-semibold">Accounts</span>
              <span className="text-gray-400">/</span>
              <span className="text-gray-800 font-semibold">Party Master</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">Party Master</h2>
            <p className="text-muted text-sm">
              Unified directory for customers, suppliers, opening balances & credit terms
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/dashboard/accounts/customer-ledger"
              className="btn-secondary text-xs inline-flex items-center gap-1.5"
            >
              Customer Ledger →
            </Link>
            <Link
              href="/dashboard/accounts/supplier-ledger"
              className="btn-secondary text-xs inline-flex items-center gap-1.5"
            >
              Supplier Ledger →
            </Link>
            <button
              type="button"
              onClick={() => handleOpenAdd(typeFilter === "Supplier" ? "Supplier" : "Customer")}
              className="btn-primary text-xs inline-flex items-center gap-1.5"
            >
              <span>+</span> Create New Party
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {actionError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center justify-between">
            <span>{actionError}</span>
            <button
              onClick={() => setActionError("")}
              className="text-red-500 font-bold hover:text-red-800 ml-3"
            >
              ×
            </button>
          </div>
        )}

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="card text-center p-4">
            <div className="text-xs text-muted font-medium uppercase tracking-wider">
              Total Customers
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{totalCustomers}</div>
          </div>

          <div className="card text-center p-4">
            <div className="text-xs text-muted font-medium uppercase tracking-wider">
              Total Suppliers
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{totalSuppliers}</div>
          </div>

          <div className="card text-center p-4">
            <div className="text-xs text-muted font-medium uppercase tracking-wider">
              Opening Debit (Dr)
            </div>
            <div className="text-lg font-bold text-emerald-700 mt-1">
              ₹{formatLedgerAmount(totalOpeningDebit)}
            </div>
          </div>

          <div className="card text-center p-4">
            <div className="text-xs text-muted font-medium uppercase tracking-wider">
              Opening Credit (Cr)
            </div>
            <div className="text-lg font-bold text-indigo-700 mt-1">
              ₹{formatLedgerAmount(totalOpeningCredit)}
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="card mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search party by name, phone, city, or GSTIN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-sm"
              />
            </div>

            {/* Type Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted font-medium">Type:</span>
              <button
                type="button"
                onClick={() => setTypeFilter("ALL")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  typeFilter === "ALL"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                All ({parties.length})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("Customer")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  typeFilter === "Customer"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Customers ({totalCustomers})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter("Supplier")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  typeFilter === "Supplier"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Suppliers ({totalSuppliers})
              </button>
            </div>
          </div>
        </div>

        {/* Parties Directory Table */}
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Party Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">City / State</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4 text-right">Opening Balance</th>
                  <th className="py-3 px-4">Credit Terms</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted">
                      <div className="w-6 h-6 border-2 border-gray-400 border-t-black rounded-full animate-spin mx-auto mb-2" />
                      Loading parties...
                    </td>
                  </tr>
                ) : filteredParties.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-muted text-sm">
                      {searchQuery
                        ? `No parties matching "${searchQuery}"`
                        : "No parties found. Click '+ Create New Party' to add one."}
                    </td>
                  </tr>
                ) : (
                  filteredParties.map((party) => {
                    const isDeleting = partyToDelete?.id === party.id && isDeletingParty;
                    const ledgerLink =
                      party.type === "Supplier"
                        ? `/dashboard/accounts/supplier-ledger?party=${encodeURIComponent(
                            party.id || party.name
                          )}`
                        : `/dashboard/accounts/customer-ledger?partyId=${encodeURIComponent(
                            party.id
                          )}`;

                    const viewLink =
                      party.type === "Customer"
                        ? `/dashboard/customers/${party.id}`
                        : `/dashboard/suppliers/${party.id}`;

                    return (
                      <tr key={party.id} className="hover:bg-gray-50 transition">
                        <td className="py-3 px-4">
                          <Link
                            href={viewLink}
                            className="font-semibold text-gray-900 hover:text-blue-600 hover:underline"
                          >
                            {party.name}
                          </Link>
                          {party.gstin && (
                            <div className="text-[11px] font-mono text-gray-500">
                              GST: {party.gstin}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                              party.type === "Customer"
                                ? "bg-blue-100 text-blue-800"
                                : party.type === "Supplier"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-teal-100 text-teal-800"
                            }`}
                          >
                            {party.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600 text-xs">
                          {party.city || "—"}
                          {party.state && `, ${party.state}`}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-gray-700">
                          {party.phone || "—"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="font-mono font-medium text-gray-900">
                            ₹{formatLedgerAmount(party.openingBalance || 0)}
                          </div>
                          <span
                            className={`text-[10px] font-semibold px-1 py-0.2 rounded ${
                              party.openingBalanceType === "Debit"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-indigo-50 text-indigo-700"
                            }`}
                          >
                            {party.openingBalanceType || "Debit"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-600">
                          {party.creditLimit ? (
                            <div>Limit: ₹{formatLedgerAmount(party.creditLimit)}</div>
                          ) : null}
                          {party.paymentTerms ? (
                            <div className="text-muted">{party.paymentTerms}</div>
                          ) : !party.creditLimit ? (
                            "—"
                          ) : null}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              party.status === "Inactive"
                                ? "bg-gray-100 text-gray-600"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {party.status || "Active"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={viewLink}
                              className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded transition"
                              title="View Details"
                            >
                              View
                            </Link>

                            <Link
                              href={ledgerLink}
                              className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition"
                              title="View Tally-Style Ledger"
                            >
                              Ledger ↗
                            </Link>

                            <button
                              type="button"
                              onClick={() => handleOpenEdit(party)}
                              className="px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 rounded transition"
                              title="Edit Party Master"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteClick(party)}
                              disabled={isDeleting}
                              className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition disabled:opacity-50"
                              title="Delete Party"
                            >
                              {isDeleting ? "..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Party Master Modal */}
      <PartyModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editingParty={editingParty}
        defaultType={defaultModalType}
        onSaved={() => {
          setModalOpen(false);
          reloadParties();
        }}
      />

      {/* Confirm Delete Party Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Party"
        message={
          partyToDelete
            ? `Are you sure you want to permanently delete "${partyToDelete.name}"? This action cannot be undone.`
            : "Are you sure you want to delete this party?"
        }
        confirmLabel="Delete Party"
        variant="danger"
        isLoading={isDeletingParty}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!isDeletingParty) {
            setDeleteModalOpen(false);
            setPartyToDelete(null);
          }
        }}
      />
    </main>
  );
}
