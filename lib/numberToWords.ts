/**
 * Indian Numbering System to Words Converter
 * Converts numeric currency amounts into formal Indian English words.
 *
 * Example:
 *   11068     -> "INR Eleven Thousand Sixty Eight Only"
 *   3173.50   -> "INR Three Thousand One Hundred Seventy Three and Fifty Paise Only"
 *   0         -> "INR Zero Only"
 */

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n];
  const ten = Math.floor(n / 10);
  const unit = n % 10;
  return unit === 0 ? TENS[ten] : `${TENS[ten]} ${ONES[unit]}`;
}

function threeDigitsToWords(n: number): string {
  const hundred = Math.floor(n / 100);
  const remainder = n % 100;
  const parts: string[] = [];

  if (hundred > 0) {
    parts.push(`${ONES[hundred]} Hundred`);
  }
  if (remainder > 0) {
    parts.push(twoDigitsToWords(remainder));
  }

  return parts.join(" ");
}

/**
 * Converts a non-negative integer into Indian words up to 999+ Crores.
 */
export function integerToIndianWords(n: number): string {
  if (n === 0) return "Zero";

  const parts: string[] = [];

  // Crores (>= 1,00,00,000)
  const crore = Math.floor(n / 10000000);
  let rem = n % 10000000;

  if (crore > 0) {
    parts.push(`${integerToIndianWords(crore)} Crore`);
  }

  // Lakhs (>= 1,00,000)
  const lakh = Math.floor(rem / 100000);
  rem %= 100000;

  if (lakh > 0) {
    parts.push(`${twoDigitsToWords(lakh)} Lakh`);
  }

  // Thousands (>= 1,00,00)
  const thousand = Math.floor(rem / 1000);
  rem %= 1000;

  if (thousand > 0) {
    parts.push(`${twoDigitsToWords(thousand)} Thousand`);
  }

  // Hundreds & Remaining (< 1,000)
  if (rem > 0) {
    parts.push(threeDigitsToWords(rem));
  }

  return parts.join(" ");
}

/**
 * Converts a currency amount (Rupees and Paise) into Indian currency words.
 *
 * @param amount - The numerical amount in Rupees (e.g., 11068 or 3173.5)
 * @param prefix - Currency prefix, defaults to "INR"
 * @returns Standard Indian currency string ending with "Only"
 */
export function amountToIndianWords(amount: number, prefix: string = "INR"): string {
  if (isNaN(amount) || !Number.isFinite(amount)) {
    return `${prefix} Zero Only`;
  }

  const rounded = Math.round((Math.abs(amount) + Number.EPSILON) * 100) / 100;
  const wholePart = Math.floor(rounded);
  const paise = Math.round((rounded - wholePart) * 100);

  const wholeWords = integerToIndianWords(wholePart);

  if (paise > 0) {
    const paiseWords = twoDigitsToWords(paise);
    if (wholePart === 0) {
      return `${prefix} ${paiseWords} Paise Only`;
    }
    return `${prefix} ${wholeWords} and ${paiseWords} Paise Only`;
  }

  return `${prefix} ${wholeWords} Only`;
}
