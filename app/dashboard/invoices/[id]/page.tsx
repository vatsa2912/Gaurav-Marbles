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
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastContext";
import { ArrowLeft, Printer, Download, Trash2, CheckCircle2, PackageCheck } from "lucide-react";

export default function InvoiceDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { showToast } = useToast();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SHOP_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);

  // Confirmation modals
  const [showDeductModal, setShowDeductModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
    window.print();
  };

  const handleExecuteDeductStock = async () => {
    if (!invoice) return;

    try {
      setActionLoading(true);
      setError("");
      const res = await confirmInvoiceAndDeductStock(invoice.id);
      showToast(res.message || "Stock deducted successfully.", "success");
      setSuccessMsg(res.message);
      setShowDeductModal(false);
      setRefreshCount((c) => c + 1);
    } catch (err) {
      console.error("Stock deduction error:", err);
      const errMsg = err instanceof Error ? err.message : "Failed to deduct inventory stock.";
      showToast(errMsg, "error");
      setError(errMsg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteDelete = async () => {
    if (!invoice) return;

    try {
      setActionLoading(true);
      await deleteInvoice(invoice.id);
      showToast("Invoice deleted successfully.", "success");
      setShowDeleteModal(false);
      router.push("/dashboard/invoices");
    } catch (err) {
      console.error("Delete error:", err);
      showToast("Could not delete invoice.", "error");
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
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                <span>Stock Deducted</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowDeductModal(true)}
                disabled={actionLoading}
                className="btn-secondary text-xs text-amber-800 border-amber-300 bg-amber-50 hover:bg-amber-100 flex items-center gap-1.5 font-semibold"
                title="Deduct stock from inventory using FIFO lots"
              >
                <PackageCheck className="w-3.5 h-3.5 text-amber-700" />
                <span>Confirm &amp; Deduct Stock</span>
              </button>
            )}

            {/* Print button */}
            <button
              type="button"
              onClick={handlePrint}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Invoice</span>
            </button>

            {/* Download PDF button */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="btn-secondary text-xs flex items-center gap-1.5"
              title="Print to PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>

            {/* Delete button */}
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              disabled={actionLoading}
              className="btn-ghost text-xs text-red-600 hover:text-red-800 flex items-center gap-1 px-2.5 py-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
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

      {/* Modal: Confirm Stock Deduction */}
      <ConfirmModal
        isOpen={showDeductModal}
        title="Deduct Stock from Inventory?"
        message={`Are you sure you want to confirm Invoice #${invoice.invoiceNumber} and deduct inventory stock? This will allocate items from active FIFO purchase lots and decrease current on-hand stock counts. This operation cannot be undone.`}
        confirmLabel="Confirm & Deduct Stock"
        variant="warning"
        isLoading={actionLoading}
        onConfirm={handleExecuteDeductStock}
        onCancel={() => {
          if (!actionLoading) setShowDeductModal(false);
        }}
      />

      {/* Modal: Confirm Delete Invoice */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete Tax Invoice"
        message={`Are you sure you want to permanently delete Invoice #${invoice.invoiceNumber}? This will remove the invoice record from the system.`}
        confirmLabel="Delete Invoice"
        variant="danger"
        isLoading={actionLoading}
        onConfirm={handleExecuteDelete}
        onCancel={() => {
          if (!actionLoading) setShowDeleteModal(false);
        }}
      />
    </main>
  );
}
