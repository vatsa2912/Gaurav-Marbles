export type PartyType = "Customer" | "Supplier" | "Both";

export type Party = {
  id: string;
  name: string;
  type: PartyType;
  address?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  gstin?: string;
  phone?: string;
  openingBalance: number;
  openingBalanceType: "Debit" | "Credit";
  creditLimit?: number;
  paymentTerms?: string;
  status: "Active" | "Inactive";
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type VoucherType =
  | "Sales"
  | "Purchase"
  | "Receipt"
  | "Payment"
  | "Journal"
  | "Contra"
  | "Debit Note"
  | "Credit Note"
  | "Opening Balance"
  | "Stock Adjustment";

export type LedgerItem = {
  productName: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
};

export type LedgerEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  formattedDate: string; // e.g. 4-10-2025
  particulars: string; // e.g. "To Bill Invoice 18%", "By Cash", "By Axis Bank"
  voucherType: VoucherType;
  voucherNumber: string;
  debit: number; // 0 if not debit
  credit: number; // 0 if not credit
  runningBalance?: number;
  runningBalanceType?: "Dr" | "Cr" | "Nil";
  narration?: string;
  items?: LedgerItem[];
  referenceId?: string;
  referenceType?: "sale" | "invoice" | "purchase" | "payment" | "journal";
  partyId: string;
  partyName: string;
};

export type LedgerPage = {
  pageNumber: number;
  totalPages: number;
  entries: LedgerEntry[];
  broughtForward?: {
    debit: number;
    credit: number;
  };
  carriedOver?: {
    debit: number;
    credit: number;
  };
  isLastPage: boolean;
};

export type LedgerReportData = {
  party: Party;
  shopName: string;
  city: string;
  dateRange: {
    from: string;
    to: string;
    label: string; // e.g. "1-Oct-2025 to 24-Jan-2026"
  };
  openingBalance: {
    amount: number;
    type: "Debit" | "Credit";
  };
  entries: LedgerEntry[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: {
    amount: number;
    type: "Debit" | "Credit";
    particulars: string; // e.g. "To Closing Balance" or "By Closing Balance"
  };
  grandTotal: number; // The equalized final total e.g. 3,67,990.00
  pages: LedgerPage[];
};

/**
 * Format a number into standard Indian financial string:
 * e.g. 20340 -> "20,340.00"
 * e.g. 200656 -> "2,00,656.00"
 */
export function formatLedgerAmount(val?: number | null): string {
  if (val === undefined || val === null || isNaN(val) || val === 0) {
    return "";
  }
  return Number(val).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format date in Tally style:
 * YYYY-MM-DD -> D-M-YYYY (e.g. "2025-10-04" -> "4-10-2025" or "4-Oct-2025")
 */
export function formatTallyDate(dateStr?: string | null, useMonthName: boolean = false): string {
  if (!dateStr) return "—";
  const clean = dateStr.trim().split("T")[0];
  const parts = clean.split("-");
  if (parts.length !== 3) return dateStr;

  const [year, month, day] = parts;
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);

  if (useMonthName) {
    const MONTHS = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    return `${d}-${MONTHS[m - 1] || month}-${year}`;
  }

  return `${d}-${m}-${year}`;
}
