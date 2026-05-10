/**
 * Centralized date formatting utility — DD-MM-YYYY format for all display.
 * NOTE: Do NOT use this for HTML date inputs (they require YYYY-MM-DD).
 * Use only for displaying dates in tables, labels, reports, and notifications.
 */

/**
 * Format a date value to DD-MM-YYYY.
 * Handles: string (ISO or YYYY-MM-DD), Date, number (ms), bigint (nanoseconds).
 * Returns empty string for null/undefined.
 */
export function formatDate(
  date: string | Date | number | bigint | null | undefined,
): string {
  if (date === null || date === undefined || date === "") return "";
  try {
    let d: Date;
    if (typeof date === "bigint") {
      // Backend stores nanoseconds — convert to milliseconds
      d = new Date(Number(date / BigInt(1_000_000)));
    } else if (typeof date === "number") {
      d = new Date(date);
    } else if (date instanceof Date) {
      d = date;
    } else {
      // string — handle YYYY-MM-DD without time zone shift
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const [year, month, day] = date.split("-").map(Number);
        return `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`;
      }
      d = new Date(date);
    }
    if (Number.isNaN(d.getTime())) return String(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return String(date);
  }
}

/**
 * Format a date value to DD-MM-YYYY HH:MM (24-hour).
 */
export function formatDateTime(
  date: string | Date | number | bigint | null | undefined,
): string {
  if (date === null || date === undefined || date === "") return "";
  try {
    let d: Date;
    if (typeof date === "bigint") {
      d = new Date(Number(date / BigInt(1_000_000)));
    } else if (typeof date === "number") {
      d = new Date(date);
    } else if (date instanceof Date) {
      d = date;
    } else {
      d = new Date(date);
    }
    if (Number.isNaN(d.getTime())) return String(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  } catch {
    return String(date);
  }
}
