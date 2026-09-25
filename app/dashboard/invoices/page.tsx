"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type Invoice,
  type ShopSettings,
  DEFAULT_SHOP_SETTINGS,
} from "@/lib/invoiceTypes";
import {
  getInvoices,
  deleteInvoice,
  getShopSettings,
} from "@/lib/invoiceService";
import { formatDisplayDate } from "@/lib/dateUtils";
import ShopSettingsModal from "@/components/invoices/ShopSettingsModal";
import { useToast } from "@/components/ui/ToastContext";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  FileText,
  Plus,
  Settings,
  Search,
  RotateCcw,
  Eye,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function InvoicesPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SHOP_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Deletion modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<{ id: string; invoiceNumber: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchInvoices = async () => {
      try {
        const [invList, shopCfg] = await Promise.all([
          getInvoices(),
          getShopSettings(),
        ]);
        if (isMounted) {
          setInvoices(invList);
          setSettings(shopCfg);
        }
      } catch (err) {
        console.error("Failed to load invoices:", err);
        showToast("Failed to load invoices", "error");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchInvoices();

    return () => {
      isMounted = false;
    };
  }, [showToast]);

  const openDeleteModal = (id: string, invoiceNumber: string) => {
    setInvoiceToDelete({ id, invoiceNumber });
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!invoiceToDelete) return;
    const { id, invoiceNumber } = invoiceToDelete;

    try {
      setDeleting(true);
      await deleteInvoice(id);
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
      showToast(`Invoice #${invoiceNumber} deleted successfully`, "success");
      setDeleteModalOpen(false);
    } catch (err) {
      console.error("Error deleting invoice:", err);
      showToast("Could not delete invoice", "error");
    } finally {
      setDeleting(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      q === "" ||
      (inv.invoiceNumber || "").toLowerCase().includes(q) ||
      (inv.consignee?.name || "").toLowerCase().includes(q) ||
      (inv.buyer?.name || "").toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === "all" ||
      (inv.status || "Draft").toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const totalBilled = invoices.reduce((sum, i) => sum + (Number(i.grandTotal) || 0), 0);
  const totalTax = invoices.reduce((sum, i) => sum + (Number(i.totalTax) || 0), 0);
  const confirmedCount = invoices.filter((i) => i.status === "Confirmed" || i.status === "Paid").length;
  const draftCount = invoices.filter((i) => (i.status || "Draft") === "Draft").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tax Invoices & Billing</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Generate GST-compliant tax invoices, customer billing records, and print ready A4 sheets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition shadow-xs cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Shop Settings</span>
          </button>

          <Link
            href="/dashboard/invoices/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Generate Bill</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Invoices
          </span>
          <div className="mt-2 text-2xl font-bold text-slate-900">{invoices.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">
            {confirmedCount} confirmed · {draftCount} drafts
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Billed Value
          </span>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            ₹{totalBilled.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">Gross billed amount</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Tax Billed
          </span>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            ₹{totalTax.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[11px] text-blue-600 font-medium mt-1">CGST, SGST & IGST</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Shop GSTIN Registration
          </span>
          <div className="mt-2 text-base font-mono font-bold text-slate-900 truncate">
            {settings.gstin}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            {settings.state} (Code: {settings.stateCode})
          </p>
        </div>
      </div>

      {/* Filter and Search Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Search Invoices
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by invoice number or customer name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-slate-50/50 hover:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Status Filter
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
            >
              <option value="all">All Invoices</option>
              <option value="Draft">Drafts</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Paid">Paid</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Invoices Table Card */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Loading invoices...
          </p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Invoices Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {search || statusFilter !== "all"
              ? "No invoices match the applied search and filter criteria."
              : "No tax invoices have been generated yet. Click below to create your first bill."}
          </p>
          <Link
            href="/dashboard/invoices/new"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Generate First Bill</span>
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4 text-center">Date</th>
                  <th className="py-3 px-4">Customer / Buyer</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4 text-right">Taxable Amt</th>
                  <th className="py-3 px-4 text-right">Total Tax</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Stock Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => {
                  const status = inv.status || "Draft";
                  const statusStyles: Record<string, string> = {
                    Draft: "bg-slate-100 text-slate-700 border-slate-200",
                    Confirmed: "bg-blue-50 text-blue-700 border-blue-200",
                    Paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
                    Cancelled: "bg-rose-50 text-rose-700 border-rose-200",
                  };

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <Link
                          href={`/dashboard/invoices/${inv.id}`}
                          className="hover:underline text-blue-600"
                        >
                          {inv.invoiceNumber}
                        </Link>
                      </td>

                      <td className="py-3 px-4 text-center text-slate-700 whitespace-nowrap">
                        {formatDisplayDate(inv.invoiceDate)}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {inv.consignee?.name || inv.buyer?.name || "Walk-in Customer"}
                        </div>
                        {inv.consignee?.phone && (
                          <div className="text-[11px] text-slate-400 font-mono">
                            {inv.consignee.phone}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-medium text-slate-700">
                        {(inv.items || []).length}
                      </td>

                      <td className="py-3 px-4 text-right font-medium text-slate-700 whitespace-nowrap">
                        ₹{Number(inv.subtotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3 px-4 text-right text-slate-600 whitespace-nowrap">
                        ₹{Number(inv.totalTax || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                        ₹{Number(inv.grandTotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                            statusStyles[status] || "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {inv.stockUpdated ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                            ✓ Deducted
                          </span>
                        ) : (
                          <span className="text-[11px] text-amber-700 font-medium">
                            Not Deducted
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/dashboard/invoices/${inv.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-[11px] transition"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View / Print</span>
                          </Link>

                          <button
                            type="button"
                            onClick={() => openDeleteModal(inv.id, inv.invoiceNumber)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Delete Invoice"
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
      )}

      {/* Accessible Confirm Modal for Invoice Deletion */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Tax Invoice"
        message={`Are you sure you want to delete Invoice #${invoiceToDelete?.invoiceNumber}? This action cannot be undone.`}
        confirmText="Delete Invoice"
        cancelText="Cancel"
        isDanger={true}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalOpen(false)}
      />

      {/* Shop Settings Modal */}
      <ShopSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        settings={settings}
        onSaved={(updated) => setSettings(updated)}
      />
    </div>
  );
}
