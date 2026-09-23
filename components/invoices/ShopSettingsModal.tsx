"use client";

import React, { useState } from "react";
import {
  DEFAULT_SHOP_SETTINGS,
  type ShopSettings,
} from "@/lib/invoiceTypes";
import { saveShopSettings } from "@/lib/invoiceService";

interface ShopSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ShopSettings;
  onSaved: (updated: ShopSettings) => void;
}

export default function ShopSettingsModal({
  isOpen,
  onClose,
  settings,
  onSaved,
}: ShopSettingsModalProps) {
  if (!isOpen) return null;

  return (
    <ShopSettingsDialog
      onClose={onClose}
      settings={settings}
      onSaved={onSaved}
    />
  );
}

function ShopSettingsDialog({
  onClose,
  settings,
  onSaved,
}: Omit<ShopSettingsModalProps, "isOpen">) {
  const [form, setForm] = useState<ShopSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    setSuccess(false);

    try {
      if (!form.shopName.trim()) {
        throw new Error("Shop name is required.");
      }
      if (!form.gstin.trim()) {
        throw new Error("GSTIN is required.");
      }

      await saveShopSettings(form);
      setSuccess(true);
      onSaved(form);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    if (window.confirm("Reset all settings to default Gaurav Marbles values?")) {
      setForm(DEFAULT_SHOP_SETTINGS);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-gray-200 overflow-hidden my-8">
        <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Shop &amp; Invoice Settings</h3>
            <p className="text-xs text-gray-300">
              Configure business details, GSTIN, bank information, and defaults
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

        <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-200">
              Settings saved successfully!
            </div>
          )}

          {/* Business & GST Profile */}
          <div>
            <h4 className="font-bold text-sm text-gray-900 mb-3 border-b border-gray-200 pb-1">
              Shop &amp; GST Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="form-field sm:col-span-2">
                <label>Shop Name</label>
                <input
                  type="text"
                  name="shopName"
                  value={form.shopName}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-field sm:col-span-2">
                <label>Address Line 1</label>
                <input
                  type="text"
                  name="addressLine1"
                  value={form.addressLine1}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-field sm:col-span-2">
                <label>Address Line 2</label>
                <input
                  type="text"
                  name="addressLine2"
                  value={form.addressLine2}
                  onChange={handleChange}
                />
              </div>

              <div className="form-field">
                <label>GSTIN / UIN</label>
                <input
                  type="text"
                  name="gstin"
                  value={form.gstin}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-field">
                <label>Contact Phone</label>
                <input
                  type="text"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-field">
                <label>State Name</label>
                <input
                  type="text"
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-field">
                <label>State Code</label>
                <input
                  type="text"
                  name="stateCode"
                  value={form.stateCode}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          {/* Bank Details */}
          <div>
            <h4 className="font-bold text-sm text-gray-900 mb-3 border-b border-gray-200 pb-1">
              Bank Details (for Printable Invoice Footer)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="form-field">
                <label>Bank Name</label>
                <input
                  type="text"
                  name="bankName"
                  value={form.bankName}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-field">
                <label>Account Holder Name</label>
                <input
                  type="text"
                  name="accountHolder"
                  value={form.accountHolder}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-field">
                <label>Account Number</label>
                <input
                  type="text"
                  name="accountNumber"
                  value={form.accountNumber}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-field">
                <label>Branch &amp; IFS Code</label>
                <input
                  type="text"
                  name="branchIfsc"
                  value={form.branchIfsc}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          {/* Tax Rates & HSN Defaults */}
          <div>
            <h4 className="font-bold text-sm text-gray-900 mb-3 border-b border-gray-200 pb-1">
              Tax &amp; HSN Defaults
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="form-field">
                <label>Default CGST Rate (%)</label>
                <input
                  type="number"
                  name="defaultCgstRate"
                  step="0.01"
                  min="0"
                  value={form.defaultCgstRate}
                  onChange={handleChange}
                />
              </div>

              <div className="form-field">
                <label>Default SGST Rate (%)</label>
                <input
                  type="number"
                  name="defaultSgstRate"
                  step="0.01"
                  min="0"
                  value={form.defaultSgstRate}
                  onChange={handleChange}
                />
              </div>

              <div className="form-field">
                <label>Default IGST Rate (%)</label>
                <input
                  type="number"
                  name="defaultIgstRate"
                  step="0.01"
                  min="0"
                  value={form.defaultIgstRate}
                  onChange={handleChange}
                />
              </div>

              <div className="form-field">
                <label>Default Tiles HSN</label>
                <input
                  type="text"
                  name="defaultTilesHsn"
                  value={form.defaultTilesHsn}
                  onChange={handleChange}
                />
              </div>

              <div className="form-field">
                <label>Default Marble HSN</label>
                <input
                  type="text"
                  name="defaultMarbleHsn"
                  value={form.defaultMarbleHsn}
                  onChange={handleChange}
                />
              </div>

              <div className="form-field">
                <label>Default Granite HSN</label>
                <input
                  type="text"
                  name="defaultGraniteHsn"
                  value={form.defaultGraniteHsn}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* Terms, Declaration & Jurisdiction */}
          <div>
            <h4 className="font-bold text-sm text-gray-900 mb-3 border-b border-gray-200 pb-1">
              Legal Declaration &amp; Jurisdiction
            </h4>
            <div className="space-y-4">
              <div className="form-field">
                <label>Declaration Text</label>
                <textarea
                  rows={2}
                  name="declaration"
                  value={form.declaration}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-field">
                  <label>Jurisdiction Notice</label>
                  <input
                    type="text"
                    name="jurisdiction"
                    value={form.jurisdiction}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-field">
                  <label>Invoice Number Prefix</label>
                  <input
                    type="text"
                    name="invoicePrefix"
                    value={form.invoicePrefix}
                    onChange={handleChange}
                    placeholder="e.g. GM"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="text-xs text-gray-500 hover:text-gray-800 underline"
            >
              Reset to Defaults
            </button>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary text-sm flex items-center gap-2"
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
