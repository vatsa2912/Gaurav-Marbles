"use client";

import React, { useState } from "react";
import {
  type LedgerReportData,
  formatLedgerAmount,
} from "@/lib/ledgerTypes";

interface TallyLedgerViewProps {
  data: LedgerReportData;
  onRecordVoucherClick?: () => void;
  onDateChange?: (from: string, to: string) => void;
}

export default function TallyLedgerView({
  data,
  onRecordVoucherClick,
  onDateChange,
}: TallyLedgerViewProps) {
  const [itemDisplay, setItemDisplay] = useState<"expanded" | "collapsed" | "hidden">("expanded");
  const [showBalance, setShowBalance] = useState(false);
  const [fromDateInput, setFromDateInput] = useState(data.dateRange.from || "");
  const [toDateInput, setToDateInput] = useState(data.dateRange.to || "");

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    if (onDateChange) {
      onDateChange(fromDateInput, toDateInput);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ["Date", "Particulars", "Vch Type", "Vch No", "Debit", "Credit"];
    if (showBalance) headers.push("Balance");

    const rows: string[][] = [];
    data.entries.forEach((e) => {
      const row = [
        `"${e.formattedDate || e.date}"`,
        `"${e.particulars}"`,
        `"${e.voucherType}"`,
        `"${e.voucherNumber}"`,
        `"${e.debit ? e.debit.toFixed(2) : ""}"`,
        `"${e.credit ? e.credit.toFixed(2) : ""}"`,
      ];
      if (showBalance) {
        row.push(`"${e.runningBalance ? e.runningBalance.toFixed(2) + " " + (e.runningBalanceType || "") : ""}"`);
      }
      rows.push(row);

      // Sub items
      if (itemDisplay === "expanded" && e.items && e.items.length > 0) {
        e.items.forEach((item) => {
          rows.push([
            "",
            `"   ${item.productName} (${item.quantity} ${item.unit} @ ${item.rate.toFixed(2)}/${item.unit})"`,
            "",
            "",
            `"${item.amount.toFixed(2)}"`,
            "",
          ]);
        });
      }
    });

    // Totals row
    rows.push(["", '"Closing Balance"', "", "", `"${data.closingBalance.type === "Debit" ? data.closingBalance.amount.toFixed(2) : ""}"`, `"${data.closingBalance.type === "Credit" ? data.closingBalance.amount.toFixed(2) : ""}"`]);
    rows.push(["", '"Total"', "", "", `"${data.grandTotal.toFixed(2)}"`, `"${data.grandTotal.toFixed(2)}"`]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${data.party.name}_Ledger_${data.dateRange.from}_to_${data.dateRange.to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* ─── Screen Controls Toolbar (Hidden in Print) ────────────────────── */}
      <div className="no-print bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Date Filter Form */}
          <form onSubmit={handleApplyFilter} className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-700 whitespace-nowrap">From:</label>
              <input
                type="date"
                value={fromDateInput}
                onChange={(e) => setFromDateInput(e.target.value)}
                className="text-xs py-1.5 px-2.5 w-36"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-700 whitespace-nowrap">To:</label>
              <input
                type="date"
                value={toDateInput}
                onChange={(e) => setToDateInput(e.target.value)}
                className="text-xs py-1.5 px-2.5 w-36"
              />
            </div>

            <button type="submit" className="btn-secondary text-xs py-1.5 px-3">
              Apply Date Filter
            </button>
          </form>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {onRecordVoucherClick && (
              <button
                type="button"
                onClick={onRecordVoucherClick}
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <span>+</span> Record Voucher
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <span>🖨️</span> Print Ledger
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <span>📥</span> Download PDF
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <span>📊</span> Export Excel
            </button>
          </div>
        </div>

        {/* View Option Switches */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 text-xs text-gray-600">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-gray-700">Invoice Items:</span>
            <div className="bg-gray-100 p-0.5 rounded-lg flex text-xs">
              <button
                type="button"
                onClick={() => setItemDisplay("expanded")}
                className={`px-2.5 py-1 rounded transition ${
                  itemDisplay === "expanded" ? "bg-white font-bold text-gray-900 shadow-xs" : "text-gray-600"
                }`}
              >
                Expanded (Tally)
              </button>
              <button
                type="button"
                onClick={() => setItemDisplay("collapsed")}
                className={`px-2.5 py-1 rounded transition ${
                  itemDisplay === "collapsed" ? "bg-white font-bold text-gray-900 shadow-xs" : "text-gray-600"
                }`}
              >
                Collapsed
              </button>
              <button
                type="button"
                onClick={() => setItemDisplay("hidden")}
                className={`px-2.5 py-1 rounded transition ${
                  itemDisplay === "hidden" ? "bg-white font-bold text-gray-900 shadow-xs" : "text-gray-600"
                }`}
              >
                Hidden
              </button>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 cursor-pointer font-medium">
            <input
              type="checkbox"
              checked={showBalance}
              onChange={(e) => setShowBalance(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-blue-600"
            />
            Show Running Balance Column
          </label>
        </div>
      </div>

      {/* ─── Tally Ledger Document Canvas (Matches G F.pdf exactly) ───────── */}
      <div
        id="tally-ledger-printable"
        className="bg-white text-black font-sans mx-auto shadow-sm print:shadow-none p-6 sm:p-10 max-w-[210mm] border border-gray-300 print:border-none print:p-0"
        style={{
          boxSizing: "border-box",
          color: "#000",
          fontSize: "11px",
          lineHeight: 1.3,
        }}
      >
        {data.pages.map((page) => (
          <div
            key={page.pageNumber}
            className={`tally-page ${page.pageNumber > 1 ? "page-break-before mt-8 pt-8 print:mt-0 print:pt-0" : ""}`}
          >
            {/* ─── Centered Header Block (Exact replica of G F.pdf) ─────────── */}
            <div className="text-center mb-4 leading-snug">
              <div className="font-bold text-base tracking-wide uppercase text-gray-950">
                {data.party.name}
              </div>
              <div className="font-medium text-xs text-gray-800">
                {data.party.city || "Agra"}
              </div>
              <div className="font-bold text-sm text-gray-900 mt-0.5">
                {data.shopName || "Gaurav Firozabad"}
              </div>
              <div className="text-xs text-gray-800 font-medium">Ledger Account</div>
              <div className="text-xs text-gray-900 mt-3 font-medium">
                {data.dateRange.label}
              </div>

              {/* Page Number (top-right of table) */}
              <div className="text-right text-xs font-semibold text-gray-800 -mt-1 mb-1">
                Page {page.pageNumber}
              </div>
            </div>

            {/* ─── Ledger Table ────────────────────────────────────────────── */}
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-t border-b border-black font-bold">
                  <th className="py-1 text-left w-20">Date</th>
                  <th className="py-1 text-left">Particulars</th>
                  <th className="py-1 text-left w-20">Vch Type</th>
                  <th className="py-1 text-center w-16">Vch No.</th>
                  <th className="py-1 text-right w-24">Debit</th>
                  <th className="py-1 text-right w-24">Credit</th>
                  {showBalance && <th className="py-1 text-right w-24">Balance</th>}
                </tr>
              </thead>

              <tbody>
                {/* Brought Forward (if Page > 1) */}
                {page.broughtForward && (
                  <tr className="font-bold border-b border-gray-200">
                    <td></td>
                    <td className="py-1">Brought Forward</td>
                    <td></td>
                    <td></td>
                    <td className="py-1 text-right font-mono font-bold">
                      {formatLedgerAmount(page.broughtForward.debit)}
                    </td>
                    <td className="py-1 text-right font-mono font-bold">
                      {formatLedgerAmount(page.broughtForward.credit)}
                    </td>
                    {showBalance && <td></td>}
                  </tr>
                )}

                {/* Ledger Entries for this page */}
                {page.entries.map((entry) => {
                  const hasSubItems =
                    itemDisplay === "expanded" && entry.items && entry.items.length > 0;

                  return (
                    <React.Fragment key={entry.id}>
                      <tr className="align-top hover:bg-gray-50/50">
                        <td className="py-0.5 text-left whitespace-nowrap">
                          {entry.formattedDate}
                        </td>
                        <td className="py-0.5 text-left font-medium">
                          {entry.particulars}
                          {entry.narration && (
                            <span className="block text-[9.5px] italic text-gray-600 font-normal">
                              ({entry.narration})
                            </span>
                          )}
                        </td>
                        <td className="py-0.5 text-left whitespace-nowrap">
                          {entry.voucherType}
                        </td>
                        <td className="py-0.5 text-center font-mono whitespace-nowrap">
                          {entry.voucherNumber}
                        </td>
                        <td className="py-0.5 text-right font-mono font-medium">
                          {formatLedgerAmount(entry.debit)}
                        </td>
                        <td className="py-0.5 text-right font-mono font-medium">
                          {formatLedgerAmount(entry.credit)}
                        </td>
                        {showBalance && (
                          <td className="py-0.5 text-right font-mono text-gray-700">
                            {formatLedgerAmount(entry.runningBalance)}{" "}
                            <span className="text-[9px] font-bold">{entry.runningBalanceType}</span>
                          </td>
                        )}
                      </tr>

                      {/* Item-wise Invoice Line Breakdown (Tally indented style) */}
                      {hasSubItems && (
                        <tr>
                          <td></td>
                          <td colSpan={showBalance ? 6 : 5} className="pb-1">
                            <div className="pl-6 space-y-0.5">
                              {entry.items!.map((subItem, sIdx) => (
                                <div
                                  key={sIdx}
                                  className="grid grid-cols-[1fr_80px_110px_90px] gap-2 text-[10px] text-gray-800"
                                >
                                  <span className="truncate">{subItem.productName}</span>
                                  <span className="text-right whitespace-nowrap font-mono">
                                    {subItem.quantity} {subItem.unit}
                                  </span>
                                  <span className="text-right whitespace-nowrap font-mono">
                                    {subItem.rate.toFixed(2)}/{subItem.unit}
                                  </span>
                                  <span className="text-right whitespace-nowrap font-mono">
                                    {formatLedgerAmount(subItem.amount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Carried Over (if not last page) */}
                {page.carriedOver && (
                  <>
                    <tr className="border-t border-black font-bold">
                      <td></td>
                      <td className="py-1 font-bold">Carried Over</td>
                      <td></td>
                      <td></td>
                      <td className="py-1 text-right font-mono font-bold">
                        {formatLedgerAmount(page.carriedOver.debit)}
                      </td>
                      <td className="py-1 text-right font-mono font-bold">
                        {formatLedgerAmount(page.carriedOver.credit)}
                      </td>
                      {showBalance && <td></td>}
                    </tr>
                    <tr>
                      <td colSpan={showBalance ? 7 : 6} className="text-right italic text-xs py-1 text-gray-600">
                        continued ...
                      </td>
                    </tr>
                  </>
                )}

                {/* Final Closing Balance & Equalized Totals (Only on Last Page) */}
                {page.isLastPage && (
                  <>
                    {/* Pre-closing column totals line */}
                    <tr className="border-t border-gray-400">
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td className="py-1 text-right font-mono font-semibold">
                        {formatLedgerAmount(data.totalDebit)}
                      </td>
                      <td className="py-1 text-right font-mono font-semibold">
                        {formatLedgerAmount(data.totalCredit)}
                      </td>
                      {showBalance && <td></td>}
                    </tr>

                    {/* Closing Balance balancing row */}
                    {data.closingBalance.amount > 0 && (
                      <tr>
                        <td></td>
                        <td className="py-0.5 font-bold">
                          {data.closingBalance.particulars}
                        </td>
                        <td></td>
                        <td></td>
                        <td className="py-0.5 text-right font-mono font-bold">
                          {data.closingBalance.type === "Debit"
                            ? formatLedgerAmount(data.closingBalance.amount)
                            : ""}
                        </td>
                        <td className="py-0.5 text-right font-mono font-bold">
                          {data.closingBalance.type === "Credit"
                            ? formatLedgerAmount(data.closingBalance.amount)
                            : ""}
                        </td>
                        {showBalance && <td></td>}
                      </tr>
                    )}

                    {/* Equalized Final Grand Total with double border bottom */}
                    <tr
                      className="border-t border-black font-bold"
                      style={{ borderBottom: "3px double #000" }}
                    >
                      <td></td>
                      <td className="py-1 font-bold uppercase">Total</td>
                      <td></td>
                      <td></td>
                      <td className="py-1 text-right font-mono font-bold text-xs">
                        {formatLedgerAmount(data.grandTotal)}
                      </td>
                      <td className="py-1 text-right font-mono font-bold text-xs">
                        {formatLedgerAmount(data.grandTotal)}
                      </td>
                      {showBalance && <td></td>}
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
