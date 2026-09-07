// Dump engine outputs for all 25 public cases to JSON for independent
// verification against a Python Decimal reference implementation.
import { readFileSync, writeFileSync } from 'fs';
import { analyze, forecastNextMonth, projectPockets, validateCase, type LedgerCase } from '../src/lib/p12/engine';
import { parseBDT, parseRateMilli } from '../src/lib/p12/money';

const raw = JSON.parse(readFileSync('src/data/P12_personal_ledger_public.json', 'utf8')) as { cases: LedgerCase[] };
const out: unknown[] = [];
for (const c of raw.cases) {
  const { v } = validateCase(c);
  const a = analyze(c);
  const fTrend = forecastNextMonth(c, 'trend');
  const fSteady = forecastNextMonth(c, 'steady');
  const rep = projectPockets(c, fSteady.projectedSavingsPaisa, 'steady');
  out.push({
    case_id: c.case_id,
    validation_errors: v.errors,
    validation_warnings: v.warnings,
    totals: { last: a.totalLast, this: a.totalThis, salary: a.salaryPaisa },
    categories: a.categories.map((r) => ({ c: r.category, last: r.lastPaisa, this: r.thisPaisa })),
    dps_rate_milli: parseRateMilli(c.dps_annual_rate_percent),
    pockets: rep.projections.map((p) => ({
      id: p.pocket.id,
      target: parseBDT(p.pocket.target_bdt),
      monthly: parseBDT(p.pocket.monthly_contribution_bdt),
      monthsNeeded: p.monthsNeeded,
      deposited: p.depositedPaisa,
      interest: p.interestPaisa,
      maturity: p.maturityPaisa,
      first3_interest: p.interestFirst3,
      schedule_first3: p.schedule.slice(0, 3).map((r) => ({ opening: r.openingPaisa, deposit: r.depositPaisa, interest: r.interestPaisa, closing: r.closingPaisa })),
      final_row: p.schedule.length > 0 ? p.schedule[p.schedule.length - 1] : null,
      forecast_steady_total: fSteady.totalPaisa,
    })),
  });
}
writeFileSync('scripts/engine-dump.json', JSON.stringify(out, null, 1));
console.log('dumped', out.length, 'cases');
