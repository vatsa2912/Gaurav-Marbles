// lib/dateUtils.ts
// Standardized date formatting, parsing, and timezone-safe comparison utilities

/**
 * Format a date string (YYYY-MM-DD or ISO timestamp) into DD-MM-YYYY for display.
 * Avoids timezone offsets that shift dates backwards when parsing YYYY-MM-DD as UTC.
 */
export function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return "—";

  // If already in YYYY-MM-DD or starts with YYYY-MM-DD
  const clean = dateStr.trim().split("T")[0];
  const parts = clean.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    if (year.length === 4 && month.length === 2 && day.length === 2) {
      return `${day}-${month}-${year}`;
    }
  }

  // Fallback for timestamp or non-standard format
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Invalid Date";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Compare two dates in descending order (newest first).
 * Supports ISO strings, YYYY-MM-DD, and Date objects.
 */
export function compareDatesDesc(a?: string | null, b?: string | null): number {
  const cleanA = (a || "").trim().split("T")[0];
  const cleanB = (b || "").trim().split("T")[0];
  if (cleanA && cleanB) {
    return cleanB.localeCompare(cleanA);
  }
  const timeA = a ? new Date(a).getTime() : 0;
  const timeB = b ? new Date(b).getTime() : 0;
  return timeB - timeA;
}

/**
 * Compare two dates in ascending order (oldest first).
 */
export function compareDatesAsc(a?: string | null, b?: string | null): number {
  const cleanA = (a || "").trim().split("T")[0];
  const cleanB = (b || "").trim().split("T")[0];
  if (cleanA && cleanB) {
    return cleanA.localeCompare(cleanB);
  }
  const timeA = a ? new Date(a).getTime() : 0;
  const timeB = b ? new Date(b).getTime() : 0;
  return timeA - timeB;
}

/**
 * Check whether a target date matches a single filter date.
 */
export function matchesDateFilter(targetDate?: string | null, filterDate?: string | null): boolean {
  if (!filterDate) return true;
  if (!targetDate) return false;
  const targetClean = targetDate.trim().split("T")[0];
  const filterClean = filterDate.trim().split("T")[0];
  return targetClean === filterClean || targetClean.startsWith(filterClean);
}

/**
 * Check whether a target date falls within a date range [fromDate, toDate] inclusive.
 */
export function matchesDateRange(
  targetDate?: string | null,
  fromDate?: string | null,
  toDate?: string | null
): boolean {
  if (!fromDate && !toDate) return true;
  if (!targetDate) return false;
  const targetClean = targetDate.trim().split("T")[0];
  if (fromDate && targetClean < fromDate.trim().split("T")[0]) return false;
  if (toDate && targetClean > toDate.trim().split("T")[0]) return false;
  return true;
}

/**
 * Safely extracts a YYYY-MM-DD transaction date from a Firestore document object,
 * checking preferredField, transactionDate, or createdAt fallback.
 */
export function extractTransactionDate(
  docData: Record<string, unknown> | null | undefined,
  preferredField: string = "purchaseDate"
): string {
  if (!docData) return getTodayDateString();

  const val = docData[preferredField] || docData["transactionDate"] || docData["saleDate"] || docData["date"];
  if (typeof val === "string" && val.trim()) {
    return val.trim().split("T")[0];
  }

  // Fallback to createdAt if Timestamp or Date
  const createdAt = docData["createdAt"];
  if (createdAt && typeof (createdAt as { toDate?: () => Date }).toDate === "function") {
    return (createdAt as { toDate: () => Date }).toDate().toISOString().split("T")[0];
  }
  if (createdAt instanceof Date) {
    return createdAt.toISOString().split("T")[0];
  }
  if (typeof createdAt === "string" && createdAt.trim()) {
    return createdAt.trim().split("T")[0];
  }

  return getTodayDateString();
}

/**
 * Returns today's date formatted as YYYY-MM-DD in local time.
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
