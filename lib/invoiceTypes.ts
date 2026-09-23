import { amountToIndianWords } from "./numberToWords";

export type PartyDetails = {
  name: string;
  address: string;
  address2?: string;
  gstin?: string;
  state: string;
  stateCode: string;
  phone?: string;
};

export type InvoiceItem = {
  id: string;
  productId?: string;
  productName: string;
  category: "Tiles" | "Marble" | "Granite" | "Other" | string;
  size?: string;
  hsn: string;
  quantity: number;
  unit: string; // "box" | "sqft" | "pcs"
  rate: number;
  amount: number;
};

export type TaxType = "CGST_SGST" | "IGST" | "NONE";

export type TaxSummaryRow = {
  hsn: string;
  taxableValue: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
};

export type ShopSettings = {
  shopName: string;
  addressLine1: string;
  addressLine2: string;
  gstin: string;
  state: string;
  stateCode: string;
  phone: string;
  email: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  branchIfsc: string;
  declaration: string;
  defaultCgstRate: number;
  defaultSgstRate: number;
  defaultIgstRate: number;
  defaultTilesHsn: string;
  defaultMarbleHsn: string;
  defaultGraniteHsn: string;
  jurisdiction: string;
  invoicePrefix: string;
};

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  shopName: "M/s Gaurav Marbles",
  addressLine1: "Purshottam Vihar, Near Tharpootha",
  addressLine2: "New Bypass Road, Firozabad",
  gstin: "09AFAPA8754N1Z3",
  state: "Uttar Pradesh",
  stateCode: "09",
  phone: "9897795715",
  email: "",
  bankName: "State Bank of India",
  accountHolder: "M/s Gaurav Marbles",
  accountNumber: "38920192840",
  branchIfsc: "SBIN0001234, Firozabad",
  declaration:
    "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",
  defaultCgstRate: 9,
  defaultSgstRate: 9,
  defaultIgstRate: 18,
  defaultTilesHsn: "6907",
  defaultMarbleHsn: "6802",
  defaultGraniteHsn: "6802",
  jurisdiction: "SUBJECT TO FIROZABAD JURISDICTION",
  invoicePrefix: "GM",
};

export type InvoiceStatus = "Draft" | "Confirmed" | "Paid" | "Cancelled";

export type Invoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  deliveryNote: string;
  paymentMode: string;
  supplierRef: string;
  otherRef: string;
  buyerOrderNo: string;
  buyerOrderDate: string;
  dispatchDocNo: string;
  deliveryNoteDate: string;
  dispatchedThrough: string;
  destination: string;
  termsOfDelivery: string;
  consignee: PartyDetails;
  buyer: PartyDetails;
  items: InvoiceItem[];
  taxType: TaxType;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  subtotal: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
  taxAmountInWords: string;
  status: InvoiceStatus;
  stockUpdated: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

/**
 * Calculates item amount with 2 decimal precision.
 */
export function calculateItemAmount(quantity: number, rate: number): number {
  const qty = Number(quantity) || 0;
  const rt = Number(rate) || 0;
  return Math.round((qty * rt + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates all invoice totals, taxes, round-off, and amounts in words.
 */
export function calculateInvoiceTotals(params: {
  items: InvoiceItem[];
  taxType: TaxType;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
}): {
  subtotal: number;
  totalQuantity: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  amountInWords: string;
  taxAmountInWords: string;
} {
  const { items, taxType, cgstRate, sgstRate, igstRate } = params;

  let subtotal = 0;
  let totalQuantity = 0;

  for (const item of items) {
    const amt = calculateItemAmount(item.quantity, item.rate);
    subtotal += amt;
    totalQuantity += Number(item.quantity) || 0;
  }
  subtotal = Math.round((subtotal + Number.EPSILON) * 100) / 100;
  totalQuantity = Math.round((totalQuantity + Number.EPSILON) * 100) / 100;

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (taxType === "CGST_SGST") {
    cgstAmount = Math.round((subtotal * (cgstRate / 100) + Number.EPSILON) * 100) / 100;
    sgstAmount = Math.round((subtotal * (sgstRate / 100) + Number.EPSILON) * 100) / 100;
  } else if (taxType === "IGST") {
    igstAmount = Math.round((subtotal * (igstRate / 100) + Number.EPSILON) * 100) / 100;
  }

  const totalTax = Math.round((cgstAmount + sgstAmount + igstAmount + Number.EPSILON) * 100) / 100;
  const rawTotal = subtotal + totalTax;
  const grandTotal = Math.round(rawTotal);
  const roundOff = Math.round((grandTotal - rawTotal + Number.EPSILON) * 100) / 100;

  const amountInWords = amountToIndianWords(grandTotal);
  const taxAmountInWords = amountToIndianWords(totalTax);

  return {
    subtotal,
    totalQuantity,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalTax,
    roundOff,
    grandTotal,
    amountInWords,
    taxAmountInWords,
  };
}

/**
 * Builds HSN/SAC grouped tax breakdown rows for Tax Summary Table.
 */
export function groupTaxSummary(params: {
  items: InvoiceItem[];
  taxType: TaxType;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
}): TaxSummaryRow[] {
  const { items, taxType, cgstRate, sgstRate, igstRate } = params;
  const hsnMap: Record<string, number> = {};

  for (const item of items) {
    const hsn = (item.hsn || "").trim() || "N/A";
    const amt = calculateItemAmount(item.quantity, item.rate);
    hsnMap[hsn] = (hsnMap[hsn] || 0) + amt;
  }

  const rows: TaxSummaryRow[] = [];

  for (const [hsn, taxableValRaw] of Object.entries(hsnMap)) {
    const taxableValue = Math.round((taxableValRaw + Number.EPSILON) * 100) / 100;
    let rowCgst = 0;
    let rowSgst = 0;
    let rowIgst = 0;

    if (taxType === "CGST_SGST") {
      rowCgst = Math.round((taxableValue * (cgstRate / 100) + Number.EPSILON) * 100) / 100;
      rowSgst = Math.round((taxableValue * (sgstRate / 100) + Number.EPSILON) * 100) / 100;
    } else if (taxType === "IGST") {
      rowIgst = Math.round((taxableValue * (igstRate / 100) + Number.EPSILON) * 100) / 100;
    }

    const rowTotalTax = Math.round((rowCgst + rowSgst + rowIgst + Number.EPSILON) * 100) / 100;

    rows.push({
      hsn,
      taxableValue,
      cgstRate: taxType === "CGST_SGST" ? cgstRate : 0,
      cgstAmount: rowCgst,
      sgstRate: taxType === "CGST_SGST" ? sgstRate : 0,
      sgstAmount: rowSgst,
      igstRate: taxType === "IGST" ? igstRate : 0,
      igstAmount: rowIgst,
      totalTax: rowTotalTax,
    });
  }

  return rows;
}
