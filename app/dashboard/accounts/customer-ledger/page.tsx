"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type Party, type LedgerReportData } from "@/lib/ledgerTypes";
import { getParties, compileCustomerLedger } from "@/lib/ledgerService";
import TallyLedgerView from "@/components/ledger/TallyLedgerView";
import RecordVoucherModal from "@/components/ledger/RecordVoucherModal";

export default function CustomerLedgerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="w-8 h-8 border-3 border-gray-300 border-t-black rounded-full animate-spin" />
        </div>
      }
    >
      <CustomerLedgerContent />
    </Suspense>
  );
}

function CustomerLedgerContent() {
  const searchParams = useSearchParams();
  const initialPartyId = searchParams.get("partyId") || "";

  const [parties, setParties] = useState<Party[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<string>(initialPartyId);
  const [fromDate, setFromDate] = useState("2025-10-01");
  const [toDate, setToDate] = useState("2026-03-31");
  const [ledgerData, setLedgerData] = useState<LedgerReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [voucherModalOpen, setVoucherModalOpen] = useState(false);

  // 1. Load initial parties
  useEffect(() => {
    let isMounted = true;
    const loadInitialParties = async () => {
      try {
        const list = await getParties();
        if (!isMounted) return;
        setParties(list);

        const customerList = list.filter((p) => p.type === "Customer" || p.type === "Both");
        if (customerList.length > 0 && !selectedPartyId) {
          setSelectedPartyId(customerList[0].id);
        }
      } catch (err) {
        console.error("Error loading parties:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadInitialParties();

    return () => {
      isMounted = false;
    };
  }, [selectedPartyId]);

  // 2. Load Customer Ledger data when party or date range changes
  useEffect(() => {
    if (!selectedPartyId) return;

    let isMounted = true;
    const fetchLedger = async () => {
      try {
        setLedgerLoading(true);
        const report = await compileCustomerLedger({
          partyId: selectedPartyId,
          fromDate,
          toDate,
        });
        if (isMounted) {
          setLedgerData(report);
        }
      } catch (err) {
        console.error("Error compiling customer ledger:", err);
      } finally {
        if (isMounted) setLedgerLoading(false);
      }
    };

    fetchLedger();

    return () => {
      isMounted = false;
    };
  }, [selectedPartyId, fromDate, toDate]);

  const customerParties = parties.filter(
    (p) => p.type === "Customer" || p.type === "Both"
  );

  return (
    <main className="page-main">
      <header className="site-header no-print">
        <h1 className="text-xl font-bold">Gaurav Marbles</h1>
        <p className="text-muted">Accounts · Customer Ledger (Tally Format)</p>
      </header>

      <div className="page-content">
        {/* Navigation Breadcrumb & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 no-print">
          <div>
            <div className="flex items-center gap-2 text-xs">
              <Link href="/dashboard" className="text-muted hover:underline">
                Dashboard
              </Link>
              <span className="text-gray-400">/</span>
              <Link href="/dashboard/accounts/parties" className="text-muted hover:underline">
                Accounts
              </Link>
              <span className="text-gray-400">/</span>
              <span className="text-gray-800 font-semibold">Customer Ledger</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">
              Customer Ledger Account
            </h2>
            <p className="text-muted text-sm">
              Statement of accounts matching standard Tally ERP printable layout
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/accounts/supplier-ledger"
              className="btn-secondary text-xs inline-flex items-center gap-1.5"
            >
              Switch to Supplier Ledger →
            </Link>

            <button
              type="button"
              onClick={() => setVoucherModalOpen(true)}
              className="btn-primary text-xs inline-flex items-center gap-1.5"
            >
              <span>+</span> Record Receipt
            </button>
          </div>
        </div>

        {/* Party Selector Card */}
        <div className="card mb-6 no-print">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="form-field sm:col-span-2">
              <label htmlFor="selectParty">Select Customer / Party Account</label>
              <select
                id="selectParty"
                value={selectedPartyId}
                onChange={(e) => setSelectedPartyId(e.target.value)}
                className="font-medium text-sm"
              >
                {customerParties.length === 0 ? (
                  <option value="">No customers found</option>
                ) : (
                  customerParties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.city ? `(${p.city})` : ""} {p.phone ? `· ${p.phone}` : ""}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="flex justify-end pb-0.5">
              <Link
                href="/dashboard/accounts/parties"
                className="btn-secondary text-xs py-2 px-3 inline-flex items-center gap-1"
              >
                Manage Party Master ↗
              </Link>
            </div>
          </div>
        </div>

        {/* Ledger Output Canvas */}
        {loading || ledgerLoading ? (
          <div className="rounded-xl bg-white p-12 text-center border border-gray-200 text-muted">
            <div className="w-8 h-8 border-3 border-gray-300 border-t-black rounded-full animate-spin mx-auto mb-3" />
            Loading customer ledger account...
          </div>
        ) : !ledgerData ? (
          <div className="rounded-xl bg-white p-10 text-center border border-gray-200">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="text-base font-semibold text-gray-900">
              No Customer Selected
            </h3>
            <p className="text-muted text-xs mt-1">
              Select a customer above or create a new customer party to view their ledger.
            </p>
          </div>
        ) : (
          <TallyLedgerView
            data={ledgerData}
            onRecordVoucherClick={() => setVoucherModalOpen(true)}
            onDateChange={(from, to) => {
              setFromDate(from);
              setToDate(to);
            }}
          />
        )}
      </div>

      {/* Record Receipt / Payment Modal */}
      <RecordVoucherModal
        isOpen={voucherModalOpen}
        onClose={() => setVoucherModalOpen(false)}
        defaultType="Receipt"
        parties={parties}
        selectedPartyId={selectedPartyId}
        onVoucherSaved={() => {
          // Trigger re-fetch
          if (selectedPartyId) {
            compileCustomerLedger({
              partyId: selectedPartyId,
              fromDate,
              toDate,
            }).then((report) => setLedgerData(report));
          }
        }}
      />
    </main>
  );
}
