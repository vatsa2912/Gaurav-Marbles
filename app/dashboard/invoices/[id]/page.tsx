"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  type Invoice,
  type ShopSettings,
  DEFAULT_SHOP_SETTINGS,
} from "@/lib/invoiceTypes";
import {
  getInvoiceById,
  deleteInvoice,
  getShopSettings,
  confirmInvoiceAndDeductStock,
} from "@/lib/invoiceService";
import TaxInvoiceDocument from "@/components/invoices/TaxInvoiceDocument";

export default function InvoiceDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SHOP_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchInvoiceData = async () => {
      try {
        const [inv, shopCfg] = await Promise.all([
          getInvoiceById(resolvedParams.id),
          getShopSettings(),
        ]);

        if (!isMounted) return;

        if (!inv) {
          setError("Invoice not found.");
        } else {
          setInvoice(inv);
          setSettings(shopCfg);
        }
      } catch (err) {
        console.error("Error loading invoice:", err);
        if (isMounted) setError("Failed to load invoice.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchInvoiceData();

    return () => {
      isMounted = false;
    };
  }, [resolvedParams.id, refreshCount]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    // In modern browsers, window.print() brings up the print dialog with 'Save as PDF'
    window.print();
  };

  const handleConfirmAndDeductStock = async () => {
    if (!invoice) return;

    const confirmed = window.confirm(
      `Confirm Invoice #${invoice.invoiceNumber} and deduct inventory stock?\n\nThis will deduct stock for all inventory items using FIFO lot allocation. This action cannot be reversed.`
    );
    if (!confirmed) return;

    try {
      setActionLoading(true);
      setError("");
      const res = await confirmInvoiceAndDeductStock(invoice.id);
      setSuccessMsg(res.message);
      // Reload updated invoice
      setRefreshCount((c) => c + 1);
    } catch (err) {
      console.error("Stock deduction error:", err);
      setError(err instanceof Error ? err.message : "Failed to deduct inventory stock.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!invoice) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete Invoice #${invoice.invoiceNumber}?`
    );
    if (!confirmed) return;

    try {
      setActionLoading(true);
      await deleteInvoice(invoice.id);
      router.push("/dashboard/invoices");
    } catch (err) {
      console.error("Delete error:", err);
      alert("Could not delete invoice.");
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="page-main p-8 text-center text-muted">
        Loading invoice...
      </main>
    );
  }

  if (error || !invoice) {
    return (
      <main className="page-main p-8">
        <div className="card max-w-xl mx-auto text-center p-8">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900">
            {error || "Invoice Not Found"}
          </h2>
          <p className="text-muted text-sm mt-2">
            The requested invoice could not be retrieved.
          </p>
          <Link
            href="/dashboard/invoices"
            className="btn-primary mt-6 inline-block"
          >
            ← Back to Invoices
          </Link>
        </div>
      </main>
    );
  }

  const isDeducted = invoice.stockUpdated;

  return (
    <main className="page-main bg-gray-100 min-h-screen">
      {/* ─── Screen Header & Action Toolbar (Hidden during printing) ────────── */}
      <div className="no-print bg-white border-b border-gray-200 sticky top-14 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/invoices"
              className="text-xs font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              ← Back
            </Link>

            <span className="text-gray-300">|</span>

            <div>
              <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <span>Invoice #{invoice.invoiceNumber}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                    invoice.status === "Confirmed" || invoice.status === "Paid"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-gray-100 text-gray-700 border-gray-300"
                  }`}
                >
                  {invoice.status}
                </span>
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Stock deduction status indicator & action */}
            {isDeducted ? (
              <span className="text-xs px-2.5 py-1 bg-green-50 text-green-700 rounded-md font-medium border border-green-200 flex items-center gap-1">
                <span>✓</span> Stock Deducted
              </span>
            ) : (
              <button
                type="button"
                onClick={handleConfirmAndDeductStock}
                disabled={actionLoading}
                className="btn-secondary text-xs text-amber-800 border-amber-300 bg-amber-50 hover:bg-amber-100 flex items-center gap-1.5 font-semibold"
                title="Deduct stock from inventory using FIFO lots"
              >
                <span>📦</span> Confirm &amp; Deduct Stock
              </button>
            )}

            {/* Print button */}
            <button
              type="button"
              onClick={handlePrint}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <span>🖨️</span> Print Invoice
            </button>

            {/* Download PDF button */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="btn-secondary text-xs flex items-center gap-1.5"
              title="Print to PDF"
            >
              <span>📥</span> Download PDF
            </button>

            {/* Delete button */}
            <button
              type="button"
              onClick={handleDelete}
              disabled={actionLoading}
              className="btn-ghost text-xs text-red-600 hover:text-red-800 px-2 py-1"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Notices */}
        {successMsg && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <div className="p-2.5 bg-green-50 text-green-800 text-xs rounded-lg border border-green-200 flex items-center justify-between">
              <span>{successMsg}</span>
              <button
                type="button"
                onClick={() => setSuccessMsg("")}
                className="text-green-700 hover:text-green-950 font-bold"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <div className="p-2.5 bg-red-50 text-red-800 text-xs rounded-lg border border-red-200">
              {error}
            </div>
          </div>
        )}
      </div>

      {/* ─── Printable Document Canvas ──────────────────────────────────────── */}
      <div className="py-6 px-2 sm:px-4 flex justify-center print:p-0 print:m-0">
        <TaxInvoiceDocument
          invoice={invoice}
          settings={settings}
        />
      </div>
    </main>
  );
}
