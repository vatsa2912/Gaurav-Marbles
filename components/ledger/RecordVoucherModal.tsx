"use client";

import React, { useState } from "react";
import { type Party } from "@/lib/ledgerTypes";
import { recordVoucher } from "@/lib/ledgerService";
import { getTodayDateString } from "@/lib/dateUtils";

interface RecordVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: "Receipt" | "Payment";
  parties: Party[];
  selectedPartyId?: string;
  onVoucherSaved: () => void;
}

export default function RecordVoucherModal({
  isOpen,
  onClose,
  defaultType = "Receipt",
  parties,
  selectedPartyId,
  onVoucherSaved,
}: RecordVoucherModalProps) {
  if (!isOpen) return null;

  return (
    <RecordVoucherDialog
      onClose={onClose}
      defaultType={defaultType}
      parties={parties}
      selectedPartyId={selectedPartyId}
      onVoucherSaved={onVoucherSaved}
    />
  );
}

function RecordVoucherDialog({
  onClose,
  defaultType,
  parties,
  selectedPartyId,
  onVoucherSaved,
}: Omit<RecordVoucherModalProps, "isOpen">) {
  const [voucherType, setVoucherType] = useState<"Receipt" | "Payment">(defaultType || "Receipt");
  const [partyId, setPartyId] = useState(selectedPartyId || (parties[0]?.id ?? ""));
  const [date, setDate] = useState(getTodayDateString());
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"Bank" | "Cash" | "UPI" | "Cheque">("Bank");
  const [account, setAccount] = useState("Axis Bank");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [againstInvoice, setAgainstInvoice] = useState("");
  const [narration, setNarration] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filteredParties = parties.filter((p) => {
    if (voucherType === "Receipt") {
      return p.type === "Customer" || p.type === "Both";
    }
    return p.type === "Supplier" || p.type === "Both";
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid positive amount.");
      return;
    }

    const selectedParty = parties.find((p) => p.id === partyId);
    if (!selectedParty) {
      setError("Please select a valid party.");
      return;
    }

    try {
      setSaving(true);

      await recordVoucher({
        date,
        voucherType,
        partyId: selectedParty.id,
        partyName: selectedParty.name,
        partyType: voucherType === "Receipt" ? "Customer" : "Supplier",
        amount: numAmount,
        paymentMode,
        account,
        referenceNumber: referenceNumber.trim() || "",
        narration: narration.trim() || "",
        againstInvoiceNo: againstInvoice.trim() || "",
      });

      onVoucherSaved();
      onClose();
    } catch (err) {
      console.error("Error recording voucher:", err);
      setError(err instanceof Error ? err.message : "Failed to record voucher.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-gray-200 overflow-hidden my-8">
        <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">
              {voucherType === "Receipt" ? "Record Customer Receipt" : "Record Supplier Payment"}
            </h3>
            <p className="text-xs text-gray-300">
              Post entry to Tally ledger &amp; update party balance
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
              {error}
            </div>
          )}

          {/* Voucher Type Toggle */}
          <div className="form-field">
            <label>Voucher Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVoucherType("Receipt")}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition ${
                  voucherType === "Receipt"
                    ? "bg-green-600 text-white border-green-600 shadow-xs"
                    : "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100"
                }`}
              >
                Receipt (From Customer)
              </button>
              <button
                type="button"
                onClick={() => setVoucherType("Payment")}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition ${
                  voucherType === "Payment"
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100"
                }`}
              >
                Payment (To Supplier)
              </button>
            </div>
          </div>

          {/* Party Selection */}
          <div className="form-field">
            <label>{voucherType === "Receipt" ? "Customer *" : "Supplier *"}</label>
            <select
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              required
            >
              <option value="">— Select Party —</option>
              {filteredParties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.city ? `(${p.city})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-field">
              <label>Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label>Amount (₹) *</label>
              <input
                type="number"
                step="any"
                min="0.01"
                placeholder="e.g. 35020.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-field">
              <label>Payment Mode</label>
              <select
                value={paymentMode}
                onChange={(e) => {
                  const m = e.target.value as "Bank" | "Cash" | "UPI" | "Cheque";
                  setPaymentMode(m);
                  if (m === "Cash") setAccount("Cash");
                  else if (account === "Cash") setAccount("Axis Bank");
                }}
              >
                <option value="Bank">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>

            <div className="form-field">
              <label>Account Name in Ledger</label>
              <input
                type="text"
                placeholder="e.g. Axis Bank or Cash"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-field">
              <label>Voucher / Ref No.</label>
              <input
                type="text"
                placeholder="e.g. 1384"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>Against Invoice / Bill No.</label>
              <input
                type="text"
                placeholder="e.g. 2085"
                value={againstInvoice}
                onChange={(e) => setAgainstInvoice(e.target.value)}
              />
            </div>
          </div>

          <div className="form-field">
            <label>Narration / Notes</label>
            <input
              type="text"
              placeholder="e.g. On A/c payment via NEFT"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
            />
          </div>

          <div className="pt-3 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary text-xs"
            >
              {saving ? "Posting..." : "Post to Ledger"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
