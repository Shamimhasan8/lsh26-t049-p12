// Exact money helpers for P12 — Personal Ledger Manager.
// ALL money is stored as integer paisa (100 paisa = 1 BDT) so that every
// sum, delta and DPS interest amount is exact (no binary-float drift).
// The DPS interest rounding rule from the case format ("rounded half up to
// the paisa") is implemented with pure integer arithmetic.

/** Parse a BDT amount string like "2475.00" / "856.5" / "1,000" into integer paisa. Returns null when invalid. */
export function parseBDT(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    return Math.round(input * 100);
  }
  const s = String(input).trim().replace(/,/g, '').replace(/[৳\s]/g, '');
  if (s === '' || !/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  const neg = s.startsWith('-');
  const body = neg ? s.slice(1) : s;
  const [ip = '0', fp = ''] = body.split('.');
  const fp2 = ((fp || '') + '00').slice(0, 2);
  const paisa = parseInt(ip || '0', 10) * 100 + parseInt(fp2, 10);
  if (!Number.isSafeInteger(paisa)) return null;
  return neg ? -paisa : paisa;
}

/** Integer paisa -> canonical BDT string with exactly 2 decimals, e.g. 85650 -> "856.50". */
export function paisaToBDT(paisa: number): string {
  const neg = paisa < 0;
  const abs = Math.abs(Math.round(paisa));
  const taka = Math.floor(abs / 100);
  const ps = abs % 100;
  return `${neg ? '-' : ''}${taka}.${String(ps).padStart(2, '0')}`;
}

/** Format paisa for display: ৳12,345.50 (South-Asian lakh/crore grouping). */
export function formatTk(paisa: number, opts: { signed?: boolean; compact?: boolean } = {}): string {
  const neg = paisa < 0;
  const abs = Math.abs(Math.round(paisa));
  const sign = neg ? '−' : opts.signed && paisa > 0 ? '+' : '';
  if (opts.compact && abs >= 100000) {
    if (abs >= 10000000) return `৳${sign}${trim((abs / 10000000).toFixed(1))}Cr`;
    return `৳${sign}${trim((abs / 100000).toFixed(abs >= 1000000 ? 0 : 1))}L`;
  }
  const body = (abs / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `৳${sign}${body}`;
}

function trim(s: string): string {
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

/** Half-up rounding of a positive ratio of two integers (n/d), per the DPS paisa rule. */
export function divRoundHalfUp(n: number, d: number): number {
  if (d <= 0) return 0;
  const q = Math.floor(n / d);
  const r = n % d;
  return r * 2 >= d ? q + 1 : q;
}

/** Rate percentage string like "9.00" -> integer milli-percent (9.00 -> 9000). */
export function parseRateMilli(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    return Math.round(input * 1000);
  }
  const s = String(input).trim().replace(/%/g, '');
  if (!/^\d+(\.\d{1,3})?$/.test(s)) return null;
  const [ip = '0', fp = ''] = s.split('.');
  const fp3 = ((fp || '') + '000').slice(0, 3);
  return parseInt(ip, 10) * 1000 + parseInt(fp3, 10);
}

/**
 * One DPS month, exactly per the official rule:
 *   balance = balance + deposit
 *   interest = balance × rate / 12 / 100, rounded HALF UP to the paisa
 *   balance = balance + interest   (interest joins the balance)
 * rateMilli = annual rate × 1000 (e.g. "9.00" -> 9000); division is exact integer math.
 */
export function dpsMonth(balancePaisa: number, depositPaisa: number, rateMilli: number): { balance: number; interest: number } {
  const afterDeposit = balancePaisa + depositPaisa;
  const interest = divRoundHalfUp(afterDeposit * rateMilli, 1200000);
  return { balance: afterDeposit + interest, interest };
}
