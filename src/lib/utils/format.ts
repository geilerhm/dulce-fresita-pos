/**
 * Format COP currency: 12000 → "$12.000"
 */
export function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date to Colombian locale
 */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

/**
 * Format time
 */
export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/**
 * Format date + time
 */
export function formatDateTime(date: string | Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

/**
 * Convert a LOCAL day (YYYY-MM-DD) into the UTC created_at boundaries
 * that match SQLite's strftime('%Y-%m-%dT%H:%M:%f', 'now') format.
 *
 * SQLite stores created_at as UTC with no "Z" suffix, so we strip the Z
 * from toISOString() so the string comparison works lexicographically.
 * This is essential because a sale made late at night in Colombia (UTC-5)
 * has a UTC timestamp on the NEXT day — naive string comparison on the
 * local date would miss it.
 */
export function localDayToUtcRange(localDateStr: string): { start: string; end: string } {
  const [y, m, d] = localDateStr.split("-").map(Number);
  // Explicit local Date constructor — avoids ambiguity in Date string parsing
  const start = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString().replace("Z", "");
  const end = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString().replace("Z", "");
  return { start, end };
}
