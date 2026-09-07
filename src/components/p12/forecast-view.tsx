'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, FlaskConical, Info, PiggyBank, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react';
import { formatTk } from '@/lib/p12/money';
import { FORECAST_METHOD_LABEL, monthLabel, nextMonth, projectPockets, type Forecast, type ForecastMethod, type LedgerCase, type PocketReport } from '@/lib/p12/engine';

interface Props {
  caseData: LedgerCase;
  forecast: Forecast;
  method: ForecastMethod;
  onMethodChange: (m: ForecastMethod) => void;
  pocketReport: PocketReport;
}

type Adjustments = Record<string, number>; // category -> percent −50..+50

export function ForecastView({ caseData, forecast: f, method, onMethodChange, pocketReport }: Props) {
  const nm = nextMonth(caseData.months.this);
  const up = f.projectedSavingsPaisa >= 0;

  const [adjustments, setAdjustments] = useState<Adjustments>({});
  const anyAdj = Object.values(adjustments).some((v) => v !== 0);

  // What-if re-derivation — pure functions over the same engine the dashboard uses.
  const whatIf = useMemo(() => {
    const rows = f.rows.map((r) => {
      const pct = adjustments[r.category] ?? 0;
      const adjForecast = pct === 0 ? r.forecastPaisa : Math.max(0, Math.round(r.forecastPaisa * (1 + pct / 100)));
      return { category: r.category, baseline: r.forecastPaisa, adjForecast, delta: adjForecast - r.forecastPaisa };
    });
    const total = rows.reduce((s, r) => s + r.adjForecast, 0);
    const savings = f.salaryPaisa - total;
    const pockets = projectPockets(caseData, savings, method);
    return { rows, total, savings, pockets };
  }, [f, adjustments, caseData, method]);

  const setAdj = (category: string, pct: number) => setAdjustments((prev) => ({ ...prev, [category]: pct }));
  const resetAdj = () => setAdjustments({});

  // completion-date shift vs the baseline (unadjusted) report
  const shiftFor = (pocketId: string): string | null => {
    const base = pocketReport.projections.find((p) => p.pocket.id === pocketId);
    const adj = whatIf.pockets.projections.find((p) => p.pocket.id === pocketId);
    if (!base || !adj) return null;
    if (!base.reachable && adj.reachable) return `now reachable — completes ${monthLabel(adj.completionMonthKey ?? '')}`;
    if (base.reachable && !adj.reachable) return 'no longer reachable at this spend level';
    if (!base.reachable && !adj.reachable) return null;
    const b = base.monthsNeeded ?? 0;
    const a = adj.monthsNeeded ?? 0;
    if (a === b) return null;
    const diff = b - a;
    return `${monthLabel(adj.completionMonthKey ?? '')} · ${diff > 0 ? `${diff} month${diff === 1 ? '' : 's'} earlier` : `${-diff} month${diff === 1 ? '' : 's'} later`}`;
  };

  const sliderCategories = f.rows.filter((r) => r.forecastPaisa > 0);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Forecast — {monthLabel(nm)} total spend</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{formatTk(f.totalPaisa)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {monthLabel(caseData.months.last)} actual was {formatTk(f.lastTotalPaisa)}
            </p>
          </CardContent>
        </Card>
        <Card className={up ? 'border-emerald-200' : 'border-rose-200'}>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Projected savings — {monthLabel(nm)}</p>
            <p className={`mt-1 flex items-center gap-1.5 text-2xl font-bold tabular-nums ${up ? 'text-emerald-700' : 'text-rose-700'}`}>
              {up ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              {formatTk(f.projectedSavingsPaisa)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">salary {formatTk(f.salaryPaisa)} − forecast · savings rate {f.projectedSavingsRatePct}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Forecast method</p>
                <Select value={method} onValueChange={(v) => onMethodChange(v as ForecastMethod)}>
                  <SelectTrigger className="mt-1 h-9 w-[220px]" aria-label="Forecast method"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FORECAST_METHOD_LABEL) as ForecastMethod[]).map((m) => (
                      <SelectItem key={m} value={m}>{FORECAST_METHOD_LABEL[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Calculator className="h-8 w-8 text-emerald-600/70" aria-hidden />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">The chosen method also drives pocket affordability on the Pockets tab.</p>
          </CardContent>
        </Card>
      </div>

      {/* What-if simulator */}
      <Card className={anyAdj ? 'border-emerald-300' : undefined}>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><FlaskConical className="h-4 w-4 text-emerald-600" /> What-if simulator</CardTitle>
              <CardDescription>Drag a category to cut or grow it — savings and every pocket completion date re-derive live from the same pure functions.</CardDescription>
            </div>
            {anyAdj && (
              <Button variant="outline" size="sm" className="h-8" onClick={resetAdj}><RotateCcw className="h-3.5 w-3.5" /> Reset scenario</Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-5">
          <div data-tour="whatif" className="grid max-h-72 gap-3 overflow-y-auto pr-1 lg:col-span-3">
            {sliderCategories.map((r) => {
              const pct = adjustments[r.category] ?? 0;
              return (
                <div key={r.category} className="grid gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{r.category}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatTk(r.forecastPaisa)} → <strong className={pct < 0 ? 'text-emerald-700' : pct > 0 ? 'text-rose-700' : ''}>{formatTk(Math.max(0, Math.round(r.forecastPaisa * (1 + pct / 100))))}</strong>
                      {pct !== 0 && <span className={`ml-1 ${pct < 0 ? 'text-emerald-700' : 'text-rose-700'}`}>({pct > 0 ? '+' : ''}{pct}%)</span>}
                    </span>
                  </div>
                  <Slider
                    value={[pct]}
                    min={-50}
                    max={50}
                    step={5}
                    onValueChange={(v) => setAdj(r.category, v[0] ?? 0)}
                    aria-label={`Adjust ${r.category} forecast by percent`}
                    className="[&_[data-slot=slider-thumb]]:border-emerald-600 [&_[data-slot=slider-range]]:bg-emerald-500"
                  />
                </div>
              );
            })}
            {sliderCategories.length === 0 && <p className="text-sm text-muted-foreground">No forecastable categories in this case window yet.</p>}
          </div>

          <div className="grid content-start gap-3 lg:col-span-2">
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Scenario outcome — {monthLabel(nm)}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-[11px] text-muted-foreground">Spend</p>
                  <p className="font-bold tabular-nums">{formatTk(whatIf.total)}{anyAdj && <span className={`ml-1 text-xs font-medium ${whatIf.total < f.totalPaisa ? 'text-emerald-700' : 'text-rose-700'}`}>{whatIf.total === f.totalPaisa ? '' : `(${whatIf.total > f.totalPaisa ? '+' : '−'}${formatTk(Math.abs(whatIf.total - f.totalPaisa))})`}</span>}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Savings</p>
                  <p className={`font-bold tabular-nums ${whatIf.savings >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatTk(whatIf.savings)}</p>
                </div>
              </div>
            </div>
            <div className="grid gap-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pocket dates under this scenario</p>
              {whatIf.pockets.projections.map((p) => {
                const shift = shiftFor(p.pocket.id);
                return (
                  <div key={p.pocket.id} className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs">
                    <span className="truncate font-medium">{p.pocket.name}</span>
                    <span className="text-right tabular-nums text-muted-foreground">
                      {p.reachable && p.completionMonthKey ? monthLabel(p.completionMonthKey) : 'not reachable'}
                      {anyAdj && shift && <span className={`ml-1 font-medium ${shift.includes('earlier') || shift.includes('now reachable') ? 'text-emerald-700' : 'text-rose-700'}`}>· {shift}</span>}
                    </span>
                  </div>
                );
              })}
              {whatIf.pockets.projections.length === 0 && <p className="text-xs text-muted-foreground">This case defines no pockets.</p>}
              {anyAdj && whatIf.savings - pocketReport.plannedMonthlyPaisa > 0 && (
                <p className="rounded-md border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5 text-[11px] leading-relaxed text-emerald-800">
                  This scenario frees <strong>{formatTk(whatIf.savings - pocketReport.plannedMonthlyPaisa)}</strong>/mo beyond the current contributions — Savings Autopilot on the <strong>Pockets</strong> tab can sweep it into any goal.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-category forecast table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Per-category forecast — {monthLabel(nm)}</CardTitle>
          <CardDescription>
            This month is partial: data covers days 1–{f.daysElapsed} of {f.daysInThis}. Lumpy categories (≤2 txns, e.g. rent) are treated as fully booked; variable ones are prorated {f.daysInThis}/{f.daysElapsed}. All three methods are shown so every number is auditable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">{monthLabel(caseData.months.last)}</TableHead>
                <TableHead className="text-right">This so far ({f.daysElapsed}d)</TableHead>
                <TableHead className="text-right">Full-month equiv.</TableHead>
                <TableHead className="text-right">Trend</TableHead>
                <TableHead className="text-right">Steady</TableHead>
                <TableHead className="text-right">Repeat last</TableHead>
                <TableHead className="text-right">Forecast</TableHead>
                <TableHead className="text-right">Δ vs last</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {f.rows.map((r) => (
                <TableRow key={r.category}>
                  <TableCell className="font-medium">
                    {r.category}
                    {r.lumpy && <Badge variant="outline" className="ml-1.5 text-[10px] font-normal text-muted-foreground">lumpy</Badge>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatTk(r.lastPaisa)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatTk(r.thisPaisa)}<span className="ml-1 text-[10px]">×{r.thisCount}</span></TableCell>
                  <TableCell className="text-right tabular-nums">{formatTk(r.fullEquivPaisa)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatTk(r.trendPaisa)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatTk(r.steadyPaisa)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatTk(r.lastPresetPaisa)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatTk(r.forecastPaisa)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${r.deltaVsLastPaisa > 0 ? 'text-rose-600' : r.deltaVsLastPaisa < 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                    {r.deltaVsLastPaisa === 0 ? '—' : formatTk(r.deltaVsLastPaisa, { signed: true })}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular-nums">{formatTk(f.lastTotalPaisa)}</TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="text-right tabular-nums">{formatTk(f.rows.reduce((s, r) => s + r.trendPaisa, 0))}</TableCell>
                <TableCell className="text-right tabular-nums">{formatTk(f.rows.reduce((s, r) => s + r.steadyPaisa, 0))}</TableCell>
                <TableCell className="text-right tabular-nums">{formatTk(f.rows.reduce((s, r) => s + r.lastPresetPaisa, 0))}</TableCell>
                <TableCell className="text-right tabular-nums">{formatTk(f.totalPaisa)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Info className="h-4 w-4 text-emerald-600" /> Method, formulas &amp; assumptions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground">
          <p><strong className="text-foreground">Step 1 — full-month equivalent.</strong> For each category: if it has ≤ 2 transactions this month and this ≥ last (lumpy — e.g. rent booked once), equivalent = max(this, last). Otherwise equivalent = this × {f.daysInThis} ÷ {f.daysElapsed}, rounded half-up to the paisa.</p>
          <p><strong className="text-foreground">Step 2 — next-month forecast.</strong> <em>Trend</em>: max(0, 2×equivalent − last) assumes the current momentum continues. <em>Steady</em>: equivalent as-is. <em>Repeat last</em>: last month&apos;s actual. The total is the exact sum of category forecasts (integer paisa — no rounding drift).</p>
          <p><strong className="text-foreground">Step 3 — what-if.</strong> Scenario percentages multiply each category forecast (floored at zero); savings = salary − adjusted total; pockets re-run the same DPS simulation with the adjusted capacity. Nothing is cached — every drag recomputes from the ledger.</p>
        </CardContent>
      </Card>

      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><PiggyBank className="h-4 w-4 text-emerald-700" /> Why this matters for pockets</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The projected savings figure {formatTk(f.projectedSavingsPaisa)} is the monthly funding capacity on the <strong className="text-foreground">Pockets</strong> tab, so goal dates always reflect what the forecast says you can actually save — not an optimistic guess.
        </CardContent>
      </Card>
    </div>
  );
}
