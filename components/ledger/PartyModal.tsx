"use client";

import React, { useState } from "react";
import { type Party, type PartyType } from "@/lib/ledgerTypes";
import { saveParty } from "@/lib/ledgerService";

interface PartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingParty?: Party | null;
  defaultType?: PartyType;
  onSaved: () => void;
}

export default function PartyModal({
  isOpen,
  onClose,
  editingParty,
  defaultType = "Customer",
  onSaved,
}: PartyModalProps) {
  if (!isOpen) return null;

  return (
    <PartyDialog
      onClose={onClose}
      editingParty={editingParty}
      defaultType={defaultType}
      onSaved={onSaved}
    />
  );
}

function PartyDialog({
  onClose,
  editingParty,
  defaultType,
  onSaved,
}: Omit<PartyModalProps, "isOpen">) {
  const [name, setName] = useState(editingParty?.name || "");
  const [type, setType] = useState<PartyType>(editingParty?.type || defaultType || "Customer");
  const [address, setAddress] = useState(editingParty?.address || "");
  const [city, setCity] = useState(editingParty?.city || "Firozabad");
  const [state, setState] = useState(editingParty?.state || "Uttar Pradesh");
  const [stateCode, setStateCode] = useState(editingParty?.stateCode || "09");
  const [gstin, setGstin] = useState(editingParty?.gstin || "");
  const [phone, setPhone] = useState(editingParty?.phone || "");
  const [openingBalance, setOpeningBalance] = useState(
    editingParty?.openingBalance ? String(editingParty.openingBalance) : "0"
  );
  const [openingBalanceType, setOpeningBalanceType] = useState<"Debit" | "Credit">(
    editingParty?.openingBalanceType || (defaultType === "Supplier" ? "Credit" : "Debit")
  );
  const [creditLimit, setCreditLimit] = useState(
    editingParty?.creditLimit ? String(editingParty.creditLimit) : ""
  );
  const [paymentTerms, setPaymentTerms] = useState(editingParty?.paymentTerms || "");
  const [status, setStatus] = useState<"Active" | "Inactive">(editingParty?.status || "Active");
  const [notes, setNotes] = useState(editingParty?.notes || "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Party name is required.");
      return;
    }

    try {
      setSaving(true);
      await saveParty({
        id: editingParty?.id,
        name: name.trim(),
        type,
        address: address.trim(),
        city: city.trim() || "Firozabad",
        state: state.trim() || "Uttar Pradesh",
        stateCode: stateCode.trim() || "09",
        gstin: gstin.trim() || "",
        phone: phone.trim() || "",
        openingBalance: parseFloat(openingBalance) || 0,
        openingBalanceType,
        creditLimit: creditLimit ? parseFloat(creditLimit) : undefined,
        paymentTerms: paymentTerms.trim() || "",
        status,
        notes: notes.trim() || "",
      });

      onSaved();
      onClose();
    } catch (err) {
      console.error("Error saving party:", err);
      setError(err instanceof Error ? err.message : "Failed to save party.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full border border-gray-200 overflow-hidden my-8">
        <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">
              {editingParty ? `Edit Party: ${editingParty.name}` : "Create New Party Master"}
            </h3>
            <p className="text-xs text-gray-300">
              Customer or Supplier details, opening balance, and ledger account setup
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="form-field sm:col-span-2">
              <label>Party Name *</label>
              <input
                type="text"
                placeholder="e.g. ABC Ceramics or Sharma Traders"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label>Party Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as PartyType)}
              >
                <option value="Customer">Customer</option>
                <option value="Supplier">Supplier</option>
                <option value="Both">Both (Cust &amp; Supp)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-field">
              <label>Address</label>
              <input
                type="text"
                placeholder="Street address or locality"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>City (Header Display in Tally)</label>
              <input
                type="text"
                placeholder="e.g. Agra, Firozabad"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-field">
              <label>State</label>
              <input
                type="text"
                placeholder="e.g. Uttar Pradesh"
                value={state}
                onChange={(e) => setState(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>State Code</label>
              <input
                type="text"
                placeholder="e.g. 09"
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="form-field">
              <label>GSTIN / UIN</label>
              <input
                type="text"
                placeholder="GST number"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>Contact Number</label>
              <input
                type="text"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>Account Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "Active" | "Inactive")}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Opening Balance Settings */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Opening Balance &amp; Ledger Terms
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="form-field">
                <label>Opening Amount (₹)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                />
              </div>

              <div className="form-field">
                <label>Balance Type</label>
                <select
                  value={openingBalanceType}
                  onChange={(e) =>
                    setOpeningBalanceType(e.target.value as "Debit" | "Credit")
                  }
                >
                  <option value="Debit">Debit (Dr - Receivable)</option>
                  <option value="Credit">Credit (Cr - Payable)</option>
                </select>
              </div>

              <div className="form-field">
                <label>Credit Limit (₹)</label>
                <input
                  type="number"
                  placeholder="Optional limit"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-field">
              <label>Payment Terms</label>
              <input
                type="text"
                placeholder="e.g. 30 days credit term"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>Internal Notes</label>
              <input
                type="text"
                placeholder="e.g. Preferred transporter, contact preference"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
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
              {saving ? "Saving..." : "Save Party"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
