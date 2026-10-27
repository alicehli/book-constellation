const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Goodreads "2025/11/14" → "Nov 14, 2025"; unknown formats pass through unchanged */
export function formatDateRead(raw: string): string {
  const m = raw.match(/^(\d{4})[/-](\d{1,2})(?:[/-](\d{1,2}))?$/);
  if (!m) return raw;
  const month = MONTHS[parseInt(m[2], 10) - 1];
  if (!month) return raw;
  return m[3] ? `${month} ${parseInt(m[3], 10)}, ${m[1]}` : `${month} ${m[1]}`;
}

/** Claude theme slugs ("grief-and-loss") → readable labels ("grief and loss") */
export function formatTheme(theme: string): string {
  return theme.replace(/[-_]+/g, " ").trim();
}
