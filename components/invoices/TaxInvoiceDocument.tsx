"use client";

import React from "react";
import {
  type Invoice,
  type ShopSettings,
  groupTaxSummary,
} from "@/lib/invoiceTypes";
import { formatDisplayDate } from "@/lib/dateUtils";

interface TaxInvoiceDocumentProps {
  invoice: Invoice;
  settings: ShopSettings;
}

export default function TaxInvoiceDocument({
  invoice,
  settings,
}: TaxInvoiceDocumentProps) {
  const taxSummaryRows = groupTaxSummary({
    items: invoice.items,
    taxType: invoice.taxType,
    cgstRate: invoice.cgstRate,
    sgstRate: invoice.sgstRate,
    igstRate: invoice.igstRate,
  });

  const totalTaxableValue = taxSummaryRows.reduce((sum, r) => sum + r.taxableValue, 0);
  const totalCgstTax = taxSummaryRows.reduce((sum, r) => sum + r.cgstAmount, 0);
  const totalSgstTax = taxSummaryRows.reduce((sum, r) => sum + r.sgstAmount, 0);
  const totalIgstTax = taxSummaryRows.reduce((sum, r) => sum + r.igstAmount, 0);
  const totalTaxAll = taxSummaryRows.reduce((sum, r) => sum + r.totalTax, 0);

  const isIntraState = invoice.taxType === "CGST_SGST";
  const isInterState = invoice.taxType === "IGST";

  return (
    <div
      id="tax-invoice-printable"
      className="bg-white text-black font-sans mx-auto shadow-sm print:shadow-none border border-black"
      style={{
        width: "100%",
        maxWidth: "210mm",
        boxSizing: "border-box",
        fontSize: "11px",
        lineHeight: 1.35,
        color: "#000",
      }}
    >
      {/* ─── Top Heading ────────────────────────────────────────────────────── */}
      <div className="text-center py-1.5 border-b border-black font-bold uppercase tracking-wider text-sm bg-gray-50 print:bg-transparent">
        Tax Invoice
      </div>

      {/* ─── Header Grid: Left (Seller & Customers) | Right (Dispatch & Metadata) ─── */}
      <div className="grid grid-cols-2 border-b border-black">
        {/* Left Side: Seller Details & Customer Details */}
        <div className="border-r border-black flex flex-col justify-between">
          {/* Seller Box */}
          <div className="p-2 border-b border-black">
            <div className="font-bold text-sm leading-tight text-gray-950">
              {settings.shopName}
            </div>
            <div className="text-xs text-gray-800">{settings.addressLine1}</div>
            <div className="text-xs text-gray-800">{settings.addressLine2}</div>
            <div className="mt-1">
              <span className="font-semibold">GSTIN/UIN:</span> {settings.gstin}
            </div>
            <div>
              <span className="font-semibold">State Name:</span> {settings.state},{" "}
              <span className="font-semibold">Code :</span> {settings.stateCode}
            </div>
            <div>
              <span className="font-semibold">Contact:</span> {settings.phone}
            </div>
          </div>

          {/* Consignee (Ship to) */}
          <div className="p-2 border-b border-black bg-gray-50/40 print:bg-transparent">
            <div className="font-bold text-[10px] uppercase tracking-wide text-gray-600 mb-0.5">
              Consignee (Ship to)
            </div>
            <div className="font-bold text-xs">{invoice.consignee.name || "—"}</div>
            <div>{invoice.consignee.address || "—"}</div>
            {invoice.consignee.address2 && <div>{invoice.consignee.address2}</div>}
            <div className="mt-0.5">
              <span className="font-semibold">GSTIN/UIN:</span>{" "}
              {invoice.consignee.gstin || "Unregistered"}
            </div>
            <div>
              <span className="font-semibold">State Name:</span>{" "}
              {invoice.consignee.state || settings.state},{" "}
              <span className="font-semibold">Code :</span>{" "}
              {invoice.consignee.stateCode || settings.stateCode}
            </div>
            {invoice.consignee.phone && (
              <div>
                <span className="font-semibold">Contact:</span> {invoice.consignee.phone}
              </div>
            )}
          </div>

          {/* Buyer (Bill to) */}
          <div className="p-2 bg-gray-50/40 print:bg-transparent">
            <div className="font-bold text-[10px] uppercase tracking-wide text-gray-600 mb-0.5">
              Buyer (Bill to)
            </div>
            <div className="font-bold text-xs">
              {invoice.buyer.name || invoice.consignee.name || "—"}
            </div>
            <div>{invoice.buyer.address || invoice.consignee.address || "—"}</div>
            {invoice.buyer.address2 && <div>{invoice.buyer.address2}</div>}
            <div className="mt-0.5">
              <span className="font-semibold">GSTIN/UIN:</span>{" "}
              {invoice.buyer.gstin || invoice.consignee.gstin || "Unregistered"}
            </div>
            <div>
              <span className="font-semibold">State Name:</span>{" "}
              {invoice.buyer.state || invoice.consignee.state || settings.state},{" "}
              <span className="font-semibold">Code :</span>{" "}
              {invoice.buyer.stateCode || invoice.consignee.stateCode || settings.stateCode}
            </div>
            {(invoice.buyer.phone || invoice.consignee.phone) && (
              <div>
                <span className="font-semibold">Contact:</span>{" "}
                {invoice.buyer.phone || invoice.consignee.phone}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Metadata Key-Value Grid */}
        <div className="flex flex-col text-[10.5px]">
          {/* Row 1: Invoice No & Dated */}
          <div className="grid grid-cols-2 border-b border-black">
            <div className="p-1.5 border-r border-black">
              <div className="text-[9px] text-gray-600 uppercase font-semibold">
                Invoice No.
              </div>
              <div className="font-bold text-xs">{invoice.invoiceNumber || "—"}</div>
            </div>
            <div className="p-1.5">
              <div className="text-[9px] text-gray-600 uppercase font-semibold">Dated</div>
              <div className="font-semibold text-xs">
                {formatDisplayDate(invoice.invoiceDate)}
              </div>
            </div>
          </div>

          {/* Row 2: Delivery Note & Payment Mode */}
          <div className="grid grid-cols-2 border-b border-black">
            <div className="p-1.5 border-r border-black">
              <div className="text-[9px] text-gray-600 uppercase font-semibold">
                Delivery Note
              </div>
              <div>{invoice.deliveryNote || "—"}</div>
            </div>
            <div className="p-1.5">
              <div className="text-[9px] text-gray-600 uppercase font-semibold">
                Mode/Terms of Payment
              </div>
              <div className="font-semibold">{invoice.paymentMode || "Immediate"}</div>
            </div>
          </div>

          {/* Row 3: Reference No. & Other References */}
          <div className="grid grid-cols-2 border-b border-black">
            <div className="p-1.5 border-r border-black">
              <div className="text-[9px] text-gray-600 uppercase font-semibold">
                Reference No. &amp; Date.
              </div>
              <div>{invoice.supplierRef || "—"}</div>
            </div>
            <div className="p-1.5">
              <div className="text-[9px] text-gray-600 uppercase font-semibold">
                Other References
              </div>
              <div>{invoice.otherRef || "—"}</div>
            </div>
          </div>

          {/* Row 4: Buyer's Order No. & Dated */}
          <div className="grid grid-cols-2 border-b border-black">
            <div className="p-1.5 border-r border-black">
              <div className="text-[9px] text-gray-600 uppercase font-semibold">
                Buyer&apos;s Order No.
              </div>
              <div>{invoice.buyerOrderNo || "—"}</div>
            </div>
            <div className="p-1.5">
              <div className="text-[9px] text-gray-600 uppercase font-semibold">Dated</div>
              <div>
                {invoice.buyerOrderDate ? formatDisplayDate(invoice.buyerOrderDate) : "—"}
              </div>
            </div>
          </div>

          {/* Row 5: Dispatch Doc No. & Delivery Note Date */}
          <div className="grid grid-cols-2 border-b border-black">
            <div className="p-1.5 border-r border-black">
              <div className="text-[9px] text-gray-600 uppercase font-semibold">
                Dispatch Doc No.
              </div>
              <div>{invoice.dispatchDocNo || "—"}</div>
            </div>
            <div className="p-1.5">
              <div className="text-[9px] text-gray-600 uppercase font-semibold">
                Delivery Note Date
              </div>
              <div>
                {invoice.deliveryNoteDate
                  ? formatDisplayDate(invoice.deliveryNoteDate)
                  : "—"}
              </div>
            </div>
          </div>

          {/* Row 6: Dispatched through & Destination */}
          <div className="grid grid-cols-2 border-b border-black">
            <div className="p-1.5 border-r border-black">
              <div className="text-[9px] text-gray-600 uppercase font-semibold">
                Dispatched through
              </div>
              <div>{invoice.dispatchedThrough || "—"}</div>
            </div>
            <div className="p-1.5">
              <div className="text-[9px] text-gray-600 uppercase font-semibold">
                Destination
              </div>
              <div>{invoice.destination || "—"}</div>
            </div>
          </div>

          {/* Row 7: Terms of Delivery */}
          <div className="p-1.5 flex-1">
            <div className="text-[9px] text-gray-600 uppercase font-semibold">
              Terms of Delivery
            </div>
            <div className="whitespace-pre-wrap">
              {invoice.termsOfDelivery || "Ex-Shop / Standard Delivery"}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Goods Table ────────────────────────────────────────────────────── */}
      <table className="w-full border-collapse border-b border-black text-[11px]">
        <thead>
          <tr className="border-b border-black bg-gray-100 print:bg-transparent font-bold text-center">
            <th className="py-1 px-1.5 border-r border-black w-8">Sl. No.</th>
            <th className="py-1 px-2 border-r border-black text-left">
              Description of Goods
            </th>
            <th className="py-1 px-1.5 border-r border-black w-16">HSN/SAC</th>
            <th className="py-1 px-2 border-r border-black text-right w-20">Quantity</th>
            <th className="py-1 px-2 border-r border-black text-right w-20">Rate</th>
            <th className="py-1 px-1.5 border-r border-black text-center w-14">Per</th>
            <th className="py-1 px-2 text-right w-24">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, idx) => {
            const isTile = item.category === "Tiles";
            return (
              <tr key={item.id || idx} className="align-top">
                <td className="py-1 px-1.5 border-r border-black text-center">{idx + 1}</td>
                <td className="py-1 px-2 border-r border-black">
                  <div className="font-bold text-gray-950">{item.productName}</div>
                  {isTile && item.size && (
                    <div className="text-[10px] text-gray-600">Size: {item.size}</div>
                  )}
                  {item.category && !isTile && item.category !== "Other" && (
                    <div className="text-[10px] text-gray-600">Type: {item.category}</div>
                  )}
                </td>
                <td className="py-1 px-1.5 border-r border-black text-center">
                  {item.hsn || "—"}
                </td>
                <td className="py-1 px-2 border-r border-black text-right font-semibold">
                  {Number(item.quantity).toLocaleString("en-IN")}{" "}
                  <span className="font-normal text-[10px]">{item.unit}</span>
                </td>
                <td className="py-1 px-2 border-r border-black text-right">
                  {Number(item.rate).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="py-1 px-1.5 border-r border-black text-center text-[10px]">
                  {item.unit}
                </td>
                <td className="py-1 px-2 text-right font-semibold">
                  {Number(item.amount).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
            );
          })}

          {/* Intermediate Tax Line Breakdown (standard Tally/Vyapar layout) */}
          {isIntraState && (
            <>
              <tr className="border-t border-gray-200">
                <td className="py-0.5 px-1.5 border-r border-black"></td>
                <td className="py-0.5 px-2 border-r border-black font-semibold text-right italic text-gray-700">
                  Output CGST @ {invoice.cgstRate}%
                </td>
                <td className="py-0.5 px-1.5 border-r border-black"></td>
                <td className="py-0.5 px-2 border-r border-black"></td>
                <td className="py-0.5 px-2 border-r border-black text-right text-gray-600">
                  {invoice.cgstRate}%
                </td>
                <td className="py-0.5 px-1.5 border-r border-black"></td>
                <td className="py-0.5 px-2 text-right font-semibold">
                  {invoice.cgstAmount.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
              <tr>
                <td className="py-0.5 px-1.5 border-r border-black"></td>
                <td className="py-0.5 px-2 border-r border-black font-semibold text-right italic text-gray-700">
                  Output SGST @ {invoice.sgstRate}%
                </td>
                <td className="py-0.5 px-1.5 border-r border-black"></td>
                <td className="py-0.5 px-2 border-r border-black"></td>
                <td className="py-0.5 px-2 border-r border-black text-right text-gray-600">
                  {invoice.sgstRate}%
                </td>
                <td className="py-0.5 px-1.5 border-r border-black"></td>
                <td className="py-0.5 px-2 text-right font-semibold">
                  {invoice.sgstAmount.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
            </>
          )}

          {isInterState && (
            <tr className="border-t border-gray-200">
              <td className="py-0.5 px-1.5 border-r border-black"></td>
              <td className="py-0.5 px-2 border-r border-black font-semibold text-right italic text-gray-700">
                Output IGST @ {invoice.igstRate}%
              </td>
              <td className="py-0.5 px-1.5 border-r border-black"></td>
              <td className="py-0.5 px-2 border-r border-black"></td>
              <td className="py-0.5 px-2 border-r border-black text-right text-gray-600">
                {invoice.igstRate}%
              </td>
              <td className="py-0.5 px-1.5 border-r border-black"></td>
              <td className="py-0.5 px-2 text-right font-semibold">
                {invoice.igstAmount.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
            </tr>
          )}

          {invoice.roundOff !== 0 && (
            <tr>
              <td className="py-0.5 px-1.5 border-r border-black"></td>
              <td className="py-0.5 px-2 border-r border-black font-semibold text-right italic text-gray-700">
                Round Off
              </td>
              <td className="py-0.5 px-1.5 border-r border-black"></td>
              <td className="py-0.5 px-2 border-r border-black"></td>
              <td className="py-0.5 px-2 border-r border-black"></td>
              <td className="py-0.5 px-1.5 border-r border-black"></td>
              <td className="py-0.5 px-2 text-right font-semibold">
                {invoice.roundOff > 0 ? "+" : ""}
                {invoice.roundOff.toFixed(2)}
              </td>
            </tr>
          )}

          {/* Filler spacer row to keep elegant A4 height if items are few */}
          <tr className="h-6">
            <td className="border-r border-black"></td>
            <td className="border-r border-black"></td>
            <td className="border-r border-black"></td>
            <td className="border-r border-black"></td>
            <td className="border-r border-black"></td>
            <td className="border-r border-black"></td>
            <td></td>
          </tr>

          {/* Grand Total Row */}
          <tr className="border-t border-black bg-gray-50 print:bg-transparent font-bold">
            <td className="py-1.5 px-1.5 border-r border-black text-center"></td>
            <td className="py-1.5 px-2 border-r border-black font-bold uppercase text-right">
              Total
            </td>
            <td className="py-1.5 px-1.5 border-r border-black"></td>
            <td className="py-1.5 px-2 border-r border-black text-right font-bold">
              {invoice.items
                .reduce((sum, i) => sum + Number(i.quantity || 0), 0)
                .toLocaleString("en-IN")}
            </td>
            <td className="py-1.5 px-2 border-r border-black"></td>
            <td className="py-1.5 px-1.5 border-r border-black"></td>
            <td className="py-1.5 px-2 text-right font-bold text-xs">
              ₹{" "}
              {Number(invoice.grandTotal).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ─── Amount Chargeable in Words ─────────────────────────────────────── */}
      <div className="p-2 border-b border-black flex justify-between items-start text-xs">
        <div>
          <div className="text-[10px] uppercase font-bold text-gray-600">
            Amount Chargeable (in words)
          </div>
          <div className="font-bold text-gray-950 mt-0.5">
            {invoice.amountInWords || "INR Zero Only"}
          </div>
        </div>
        <div className="text-[10px] text-gray-500 italic font-semibold">E. &amp; O.E.</div>
      </div>

      {/* ─── Tax Summary Table (Grouped by HSN/SAC) ─────────────────────────── */}
      <div className="border-b border-black">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="border-b border-black bg-gray-100 print:bg-transparent text-center font-bold">
              <th rowSpan={2} className="py-1 px-1.5 border-r border-black w-24">
                HSN/SAC
              </th>
              <th rowSpan={2} className="py-1 px-2 border-r border-black text-right w-24">
                Taxable Value
              </th>
              {isIntraState ? (
                <>
                  <th colSpan={2} className="py-1 px-1 border-r border-black">
                    Central Tax
                  </th>
                  <th colSpan={2} className="py-1 px-1 border-r border-black">
                    State Tax
                  </th>
                </>
              ) : isInterState ? (
                <th colSpan={2} className="py-1 px-1 border-r border-black">
                  Integrated Tax
                </th>
              ) : null}
              <th rowSpan={2} className="py-1 px-2 text-right w-24">
                Total Tax Amount
              </th>
            </tr>
            <tr className="border-b border-black bg-gray-50 print:bg-transparent text-center font-bold">
              {isIntraState && (
                <>
                  <th className="py-0.5 px-1 border-r border-black w-12">Rate</th>
                  <th className="py-0.5 px-2 border-r border-black text-right w-20">Amount</th>
                  <th className="py-0.5 px-1 border-r border-black w-12">Rate</th>
                  <th className="py-0.5 px-2 border-r border-black text-right w-20">Amount</th>
                </>
              )}
              {isInterState && (
                <>
                  <th className="py-0.5 px-1 border-r border-black w-14">Rate</th>
                  <th className="py-0.5 px-2 border-r border-black text-right w-24">Amount</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {taxSummaryRows.map((row) => (
              <tr key={row.hsn} className="text-center">
                <td className="py-1 px-1.5 border-r border-black font-mono font-medium">
                  {row.hsn}
                </td>
                <td className="py-1 px-2 border-r border-black text-right">
                  {row.taxableValue.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                {isIntraState && (
                  <>
                    <td className="py-1 px-1 border-r border-black text-gray-700">
                      {row.cgstRate}%
                    </td>
                    <td className="py-1 px-2 border-r border-black text-right">
                      {row.cgstAmount.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-1 px-1 border-r border-black text-gray-700">
                      {row.sgstRate}%
                    </td>
                    <td className="py-1 px-2 border-r border-black text-right">
                      {row.sgstAmount.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </>
                )}
                {isInterState && (
                  <>
                    <td className="py-1 px-1 border-r border-black text-gray-700">
                      {row.igstRate}%
                    </td>
                    <td className="py-1 px-2 border-r border-black text-right">
                      {row.igstAmount.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </>
                )}
                <td className="py-1 px-2 text-right font-semibold">
                  {row.totalTax.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
            ))}
            <tr className="border-t border-black bg-gray-50 print:bg-transparent font-bold">
              <td className="py-1 px-1.5 border-r border-black text-center uppercase">Total</td>
              <td className="py-1 px-2 border-r border-black text-right">
                {totalTaxableValue.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
              {isIntraState && (
                <>
                  <td className="py-1 px-1 border-r border-black"></td>
                  <td className="py-1 px-2 border-r border-black text-right">
                    {totalCgstTax.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-1 px-1 border-r border-black"></td>
                  <td className="py-1 px-2 border-r border-black text-right">
                    {totalSgstTax.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </>
              )}
              {isInterState && (
                <>
                  <td className="py-1 px-1 border-r border-black"></td>
                  <td className="py-1 px-2 border-r border-black text-right">
                    {totalIgstTax.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </>
              )}
              <td className="py-1 px-2 text-right font-bold">
                ₹{" "}
                {totalTaxAll.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Tax Amount in Words */}
        <div className="p-1.5 border-t border-black text-[10px]">
          <span className="font-bold text-gray-700">Tax Amount (in words): </span>
          <span className="font-bold text-gray-950">
            {invoice.taxAmountInWords || "INR Zero Only"}
          </span>
        </div>
      </div>

      {/* ─── Footer: Declaration & Bank Details (Left) | Signature Area (Right) ─ */}
      <div className="grid grid-cols-2 border-b border-black">
        {/* Left Footer Column */}
        <div className="p-2 border-r border-black flex flex-col justify-between text-[10px]">
          {/* Bank Details */}
          <div className="mb-2">
            <div className="font-bold uppercase tracking-wider text-[9px] text-gray-600 mb-0.5">
              Company&apos;s Bank Details
            </div>
            <div className="grid grid-cols-[100px_1fr] gap-0.5">
              <span className="font-semibold">A/c Holder&apos;s Name:</span>
              <span className="font-bold">{settings.accountHolder || settings.shopName}</span>
              <span className="font-semibold">Bank Name:</span>
              <span>{settings.bankName}</span>
              <span className="font-semibold">A/c No.:</span>
              <span className="font-mono font-bold">{settings.accountNumber}</span>
              <span className="font-semibold">Branch &amp; IFS Code:</span>
              <span>{settings.branchIfsc}</span>
            </div>
          </div>

          {/* Declaration */}
          <div className="pt-1.5 border-t border-gray-300">
            <div className="font-bold uppercase tracking-wider text-[9px] text-gray-600 mb-0.5">
              Declaration
            </div>
            <p className="text-[9.5px] leading-tight text-gray-800">
              {settings.declaration}
            </p>
          </div>
        </div>

        {/* Right Footer Column: Signatures */}
        <div className="p-2 flex flex-col justify-between text-right">
          <div className="text-[10px]">
            for <span className="font-bold text-xs text-gray-950">{settings.shopName}</span>
          </div>

          <div className="h-16 flex items-center justify-end">
            {/* Blank space reserved for official shop stamp & physical signature */}
          </div>

          <div className="border-t border-gray-400 pt-1">
            <span className="font-bold text-[10px] text-gray-900">
              Authorised Signatory
            </span>
          </div>
        </div>
      </div>

      {/* ─── Bottom Marks & Jurisdiction ────────────────────────────────────── */}
      <div className="grid grid-cols-3 p-1 text-[9px] font-semibold text-gray-600 uppercase tracking-wider bg-gray-50 print:bg-transparent">
        <div>Customer&apos;s Seal and Signature</div>
        <div className="text-center font-bold text-gray-900">
          {settings.jurisdiction || "SUBJECT TO FIROZABAD JURISDICTION"}
        </div>
        <div className="text-right italic">This is a Computer Generated Invoice</div>
      </div>
    </div>
  );
}
