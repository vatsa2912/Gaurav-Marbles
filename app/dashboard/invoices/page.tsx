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

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SHOP_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

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
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchInvoices();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDelete = async (id: string, invoiceNumber: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete Invoice #${invoiceNumber}? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await deleteInvoice(id);
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    } catch (err) {
      console.error("Error deleting invoice:", err);
      alert("Could not delete invoice.");
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
    <main className="page-main">
      <header className="site-header no-print">
        <h1 className="text-xl font-bold">Gaurav Marbles</h1>
        <p className="text-muted">Tax Invoices &amp; Customer Billing</p>
      </header>

      <div className="page-content">
        {/* Top Header & Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Invoices &amp; Billing</h2>
            <p className="text-muted text-sm mt-1">
              Generate GST-compliant tax invoices, manage customer bills, and print A4 sheets
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSettingsModalOpen(true)}
              className="btn-secondary text-sm inline-flex items-center gap-1.5"
            >
              <span>⚙</span> Shop Settings
            </button>

            <Link
              href="/dashboard/invoices/new"
              className="btn-primary text-sm inline-flex items-center gap-1.5"
            >
              <span>+</span> Generate Bill
            </Link>
          </div>
        </div>

        {/* Metric KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="card p-4">
            <div className="text-xs text-muted font-medium uppercase tracking-wider">
              Total Invoices
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {invoices.length}
            </div>
            <div className="text-xs text-muted mt-1">
              {confirmedCount} confirmed · {draftCount} drafts
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs text-muted font-medium uppercase tracking-wider">
              Total Billed Value
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              ₹ {totalBilled.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-green-600 mt-1 font-medium">
              Gross billed amount
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs text-muted font-medium uppercase tracking-wider">
              Total Tax Billed
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              ₹ {totalTax.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-blue-600 mt-1 font-medium">
              CGST, SGST &amp; IGST
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs text-muted font-medium uppercase tracking-wider">
              Registered Shop GSTIN
            </div>
            <div className="text-base font-bold font-mono text-gray-900 mt-1 truncate">
              {settings.gstin}
            </div>
            <div className="text-xs text-gray-500 mt-1 truncate">
              {settings.state} (Code: {settings.stateCode})
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="card mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="form-field sm:col-span-2">
              <label htmlFor="searchInvoice">Search Invoices</label>
              <input
                id="searchInvoice"
                type="text"
                placeholder="Search by invoice number or customer name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="statusFilter">Status Filter</label>
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
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

        {/* Invoices Table */}
        {loading ? (
          <div className="rounded-xl bg-white p-8 text-center border border-gray-200">
            Loading invoices...
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="rounded-xl bg-white p-10 text-center border border-gray-200">
            <div className="text-5xl">📄</div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              No Invoices Found
            </h3>
            <p className="text-muted mt-2 text-sm">
              {search || statusFilter !== "all"
                ? "No invoices match the applied filters."
                : "No tax invoices have been generated yet. Click below to create your first bill."}
            </p>
            <Link
              href="/dashboard/invoices/new"
              className="btn-primary mt-5 inline-flex items-center gap-2"
            >
              + Generate First Bill
            </Link>
          </div>
        ) : (
          <div className="table-wrapper overflow-x-auto w-full">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="text-left font-medium min-w-[130px]">Invoice No.</th>
                  <th className="text-center font-medium min-w-[100px]">Date</th>
                  <th className="text-left font-medium min-w-[180px]">Customer / Consignee</th>
                  <th className="text-center font-medium min-w-[80px]">Items</th>
                  <th className="text-right font-medium min-w-[110px]">Taxable Amt</th>
                  <th className="text-right font-medium min-w-[100px]">Total Tax</th>
                  <th className="text-right font-medium min-w-[120px]">Grand Total</th>
                  <th className="text-center font-medium min-w-[100px]">Status</th>
                  <th className="text-center font-medium min-w-[110px]">Stock Status</th>
                  <th className="text-center font-medium min-w-[130px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => {
                  const status = inv.status || "Draft";
                  const statusColors: Record<string, string> = {
                    Draft: "bg-gray-100 text-gray-800 border-gray-300",
                    Confirmed: "bg-blue-50 text-blue-800 border-blue-200",
                    Paid: "bg-green-50 text-green-800 border-green-200",
                    Cancelled: "bg-red-50 text-red-800 border-red-200",
                  };

                  return (
                    <tr key={inv.id} className="hover:bg-gray-50/60">
                      <td className="font-bold font-mono text-gray-900">
                        <Link
                          href={`/dashboard/invoices/${inv.id}`}
                          className="hover:underline text-blue-700"
                        >
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="text-center text-sm">
                        {formatDisplayDate(inv.invoiceDate)}
                      </td>
                      <td className="text-left">
                        <div className="font-semibold text-gray-900">
                          {inv.consignee?.name || inv.buyer?.name || "Walk-in Customer"}
                        </div>
                        {inv.consignee?.phone && (
                          <div className="text-xs text-muted">{inv.consignee.phone}</div>
                        )}
                      </td>
                      <td className="text-center font-mono text-xs">
                        {(inv.items || []).length}
                      </td>
                      <td className="text-right font-medium">
                        ₹ {Number(inv.subtotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-right text-gray-700">
                        ₹ {Number(inv.totalTax || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-right font-bold text-gray-900">
                        ₹ {Number(inv.grandTotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                            statusColors[status] || "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="text-center">
                        {inv.stockUpdated ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                            ✓ Deducted
                          </span>
                        ) : (
                          <span className="text-xs text-amber-700 font-medium">
                            Not Deducted
                          </span>
                        )}
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}
                            className="text-xs font-semibold text-blue-600 hover:underline"
                          >
                            View / Print
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(inv.id, inv.invoiceNumber)}
                            className="text-xs font-semibold text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Shop Settings Modal */}
      <ShopSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        settings={settings}
        onSaved={(updated) => setSettings(updated)}
      />
    </main>
  );
}
