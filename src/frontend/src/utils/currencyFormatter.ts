/**
 * Formats a number (in rupees) to Indian Rupee format with Indian comma notation
 * e.g., 125000 → ₹ 1,25,000
 * e.g., 1500 → ₹ 1,500
 * e.g., 0 → ₹ 0
 */
export function formatCurrency(amount: number | bigint): string {
  const num = typeof amount === "bigint" ? Number(amount) : amount;
  if (Number.isNaN(num)) return "₹ 0";

  // Indian comma formatting: last 3 digits, then groups of 2
  const isNegative = num < 0;
  const absNum = Math.abs(Math.round(num));
  const str = absNum.toString();

  if (str.length <= 3) {
    return `${isNegative ? "-" : ""}₹ ${str}`;
  }

  // Last 3 digits
  const last3 = str.slice(-3);
  const rest = str.slice(0, -3);

  // Group rest in pairs from right
  let formattedRest = "";
  for (let i = rest.length; i > 0; i -= 2) {
    const start = Math.max(0, i - 2);
    formattedRest =
      rest.slice(start, i) + (formattedRest ? `,${formattedRest}` : "");
  }

  return `${isNegative ? "-" : ""}₹ ${formattedRest},${last3}`;
}

/**
 * Formats paise (100ths of rupee) to INR format
 * e.g., 12500000 paise → ₹ 1,25,000
 */
export function formatPaise(paise: number | bigint): string {
  const num = typeof paise === "bigint" ? Number(paise) : paise;
  return formatCurrency(num / 100);
}

/**
 * Parses INR formatted string back to number
 * e.g., '₹ 1,25,000' → 125000
 */
export function parseCurrency(formatted: string): number {
  return Number.parseFloat(formatted.replace(/[₹,\s]/g, "")) || 0;
}
