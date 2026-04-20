// Locale used for all user-facing date / number formatting. The product ships
// with EN UI but targets a Romanian audience (RON pricing, eMAG links), so
// numbers use RO grouping ("1 234,5") and dates use DD-MMM-YYYY which reads
// cleanly to both EN and RO speakers ("15 Apr 2026"). Swap to a user-profile
// pref later if we ever want a true locale toggle.
const LOCALE = 'ro-RO';

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(LOCALE, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' });
}

export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString(LOCALE, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatCurrency(amount: number, currency = 'RON'): string {
  return `${formatNumber(amount)} ${currency}`;
}

export function formatPercent(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

export function getDaysAgo(days: number): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}
