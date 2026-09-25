// lib/customerBalance.ts
// Customer account reconciliation, outstanding balances, and payment status calculation

import { getTodayDateString } from "./dateUtils";

export type PaymentStatus = "paid" | "partial" | "unpaid" | "overdue";

export interface CustomerSale {
  id: string;
  saleNumber?: number;
  saleDate?: string;
  totalAmount: number;
  paidAmount?: number;
  receivedAmount?: number;
  dueDate?: string;
  customerId?: string;
  customerName?: string;
}

export type SaleRecord = CustomerSale;
export type CustomerSaleRecord = CustomerSale;

export interface CustomerPaymentRecord {
  id?: string;
  customerId: string;
  customerName?: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: "Cash" | "UPI" | "Bank Transfer" | "Cheque" | string;
  saleId?: string;
  saleNumber?: number;
  notes?: string;
  note?: string;
  createdAt?: unknown;
}

export interface CustomerBalanceSummary {
  totalInvoiced: number;
  totalPaid: number;
  totalReceived: number; // alias for totalPaid
  totalOutstanding: number;
  outstandingBalance: number; // alias for totalOutstanding
  totalCredit: number;
  creditBalance: number; // alias for totalCredit
  overdueAmount: number;
  salesCount: number;
  paidSalesCount: number;
  partialSalesCount: number;
  unpaidSalesCount: number;
}

/**
 * Extract effective paid/received amount on a sale document,
 * reading receivedAmount first, then paidAmount, defaulting safely to 0.
 */
export function getEffectiveSalePaid(sale: CustomerSale): number {
  const p =
    sale.receivedAmount !== undefined
      ? sale.receivedAmount
      : sale.paidAmount !== undefined
      ? sale.paidAmount
      : 0;
  const n = Number(p);
  return isNaN(n) ? 0 : Math.max(0, n);
}

/**
 * Determine payment status for a single sale.
 * Supports both object signature: getSalePaymentStatus(sale, referenceDate?)
 * and numeric signature: getSalePaymentStatus(totalAmount, paidAmount, dueDate?, referenceDate?)
 */
export function getSalePaymentStatus(
  saleOrTotal: CustomerSale | number,
  paidAmountOrRefDate?: number | string,
  maybeDueDate?: string,
  maybeRefDate?: string
): PaymentStatus {
  let invTotal: number;
  let paid: number;
  let dueDate: string | undefined;
  let refDate = getTodayDateString();

  if (typeof saleOrTotal === "object" && saleOrTotal !== null) {
    invTotal = Math.max(0, Number(saleOrTotal.totalAmount) || 0);
    paid = getEffectiveSalePaid(saleOrTotal);
    dueDate = saleOrTotal.dueDate;
    if (typeof paidAmountOrRefDate === "string" && paidAmountOrRefDate) {
      refDate = paidAmountOrRefDate;
    }
  } else {
    invTotal = Math.max(0, Number(saleOrTotal) || 0);
    paid = Math.max(0, Number(paidAmountOrRefDate) || 0);
    dueDate = maybeDueDate;
    if (maybeRefDate) {
      refDate = maybeRefDate;
    }
  }

  // 1. Paid in full
  if (paid >= invTotal && invTotal > 0) {
    return "paid";
  }

  // 2. Overdue: due date is in the past and balance remains
  if (dueDate && dueDate < refDate && paid < invTotal) {
    return "overdue";
  }

  // 3. Partially paid
  if (paid > 0 && paid < invTotal) {
    return "partial";
  }

  // 4. Unpaid
  return "unpaid";
}

/**
 * Reconcile a customer's full balance across all their sales and payments.
 * Prevents double-counting by segregating direct payments linked to a saleId
 * from unallocated account payments.
 */
export function reconcileCustomerBalance(
  sales: CustomerSale[],
  directPayments: CustomerPaymentRecord[] = [],
  refDate: string = getTodayDateString()
): CustomerBalanceSummary {
  let totalInvoiced = 0;
  let totalPaidOnSales = 0;
  let overdueAmount = 0;
  let paidSalesCount = 0;
  let partialSalesCount = 0;
  let unpaidSalesCount = 0;

  // 1. Map direct payments by saleId to avoid double-counting
  const paymentsBySaleId: Record<string, number> = {};
  let unallocatedPaymentsTotal = 0;

  for (const payment of directPayments) {
    const amt = Math.max(0, Number(payment.amount) || 0);
    if (payment.saleId) {
      paymentsBySaleId[payment.saleId] =
        (paymentsBySaleId[payment.saleId] || 0) + amt;
    } else {
      unallocatedPaymentsTotal += amt;
    }
  }

  // 2. Calculate per-sale payments & statuses
  for (const sale of sales) {
    const invTotal = Math.max(0, Number(sale.totalAmount) || 0);
    const saleRecordedPaid = getEffectiveSalePaid(sale);
    const saleDirectPaid = paymentsBySaleId[sale.id] || 0;

    // To prevent double counting: take max of what was recorded on sale vs linked payments
    const effectivePaid = Math.max(saleRecordedPaid, saleDirectPaid);

    totalInvoiced += invTotal;
    totalPaidOnSales += effectivePaid;

    const status = getSalePaymentStatus(invTotal, effectivePaid, sale.dueDate, refDate);
    if (status === "paid") {
      paidSalesCount++;
    } else if (status === "partial") {
      partialSalesCount++;
    } else if (status === "overdue") {
      unpaidSalesCount++;
      overdueAmount += Math.max(0, invTotal - effectivePaid);
    } else {
      unpaidSalesCount++;
    }
  }

  const totalPaid = totalPaidOnSales + unallocatedPaymentsTotal;
  const netBalance = totalInvoiced - totalPaid;

  const totalOutstanding = netBalance > 0 ? netBalance : 0;
  const totalCredit = netBalance < 0 ? Math.abs(netBalance) : 0;

  return {
    totalInvoiced,
    totalPaid,
    totalReceived: totalPaid,
    totalOutstanding,
    outstandingBalance: totalOutstanding,
    totalCredit,
    creditBalance: totalCredit,
    overdueAmount,
    salesCount: sales.length,
    paidSalesCount,
    partialSalesCount,
    unpaidSalesCount,
  };
}
