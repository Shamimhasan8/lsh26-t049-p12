'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, ChevronDown, Landmark, RotateCcw, Sparkles, Target, Wallet } from 'lucide-react';
import { formatTk, parseBDT } from '@/lib/p12/money';
import { monthLabel, projectPockets, type ForecastMethod, type LedgerCase, type PocketReport } from '@/lib/p12/engine';

interface Props {
  caseData: LedgerCase;
  report: PocketReport;
  method: ForecastMethod;
  onContributionChange: (pocketId: string, bdt: string) => void;
  onResetPocket: (pocketId: string) => void;
  overriddenPocketIds: string[];
}

const re = /^\d+(\.\d{1,2})?$/;

export function PocketsView({ caseData, report, method, onContributionChange, onResetPocket, overriddenPocketIds }: Props) {
  const [openId, setOpenId] = useState<string | null>(report.projections[0]?.pocket.id ?? null);
  const dpsRule = caseData.dps_rule || 'balance = balance + deposit; interest = balance × rate/12/100 rounded half up to the paisa; interest joins the balance.';

  const overridden = new Set(overriddenPocketIds);
  const headroom = report.headroomPaisa;

  // ---- Autopilot: preview sweeping the unallocated headroom into one pocket
  const [sweepTarget, setSweepTarget] = useState<string>('');
  const sweepable = report.projections.filter((p) => p.monthlyPaisa > 0 || headroom > 0);
  const effectiveTarget = sweepTarget || sweepable[0]?.pocket.id || '';

  let sweepPreview: { after: PocketReport['projections'][number]; monthsSaved: number; newContribution: string } | null = null;
  if (effectiveTarget && headroom > 0) {
    const target = report.projections.find((p) => p.pocket.id === effectiveTarget);
    if (target) {
      const modified: LedgerCase = {
        ...caseData,
        pockets: caseData.pockets.map((p) =>
          p.id === effectiveTarget
            ? { ...p, monthly_contribution_bdt: (((parseBDT(p.monthly_contribution_bdt) ?? 0) + headroom) / 100).toFixed(2) }
            : p,
        ),
      };
      const before = report.projections.find((p) => p.pocket.id === effectiveTarget)!;
      const after = projectPockets(modified, report.capacityPaisa, method).projections.find((p) => p.pocket.id === effectiveTarget)!;
      const monthsSaved = (before.monthsNeeded ?? Number.POSITIVE_INFINITY) - (after.monthsNeeded ?? Number.POSITIVE_INFINITY);
      sweepPreview = { after, monthsSaved, newContribution: (((parseBDT(target.pocket.monthly_contribution_bdt) ?? 0) + headroom) / 100).toFixed(2) };
    }
  }

  return (
    <div className="grid gap-4">
      {/* Affordability banner */}
      <Card data-tour="pockets-banner" className={report.affordable ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-300 bg-amber-50/60'}>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
          <div className="flex items-center gap-2">
            {report.affordable ? <Wallet className="h-5 w-5 text-emerald-700" /> : <AlertTriangle className="h-5 w-5 text-amber-700" />}
            <p className="text-sm font-semibold">{report.affordable ? 'Plan is affordable' : 'Plan exceeds forecast savings'}</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>Planned contributions: <strong className="text-foreground">{formatTk(report.plannedMonthlyPaisa)}</strong>/mo</span>
            <span>Forecast capacity: <strong className="text-foreground">{formatTk(report.capacityPaisa)}</strong>/mo</span>
            <span>
              {report.affordable ? 'Headroom' : 'Shortfall'}: <strong className={report.affordable ? 'text-emerald-700' : 'text-rose-700'}>{formatTk(Math.abs(headroom))}</strong>/mo
            </span>
            {report.maxMonths !== null && report.maxMonths > 0 && (
              <span>Longest goal finishes: <strong className="text-foreground">{monthLabel(report.projections.find((p) => p.monthsNeeded === report.maxMonths)?.completionMonthKey ?? caseData.months.this)}</strong></span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Autopilot */}
      {headroom > 0 && sweepable.length > 0 && (
        <Card className="border-emerald-300 bg-gradient-to-r from-emerald-50 via-white to-white">
          <CardContent className="flex flex-wrap items-center gap-x-5 gap-y-3 p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white"><Sparkles className="h-5 w-5" /></div>
              <div>
                <p className="text-sm font-bold">Savings Autopilot</p>
                <p className="text-xs text-muted-foreground">{formatTk(headroom)}/mo of forecast capacity is unallocated — sweep it into a pocket and its DPS schedule re-derives instantly.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={effectiveTarget} onValueChange={setSweepTarget}>
                <SelectTrigger className="h-9 w-[190px]" aria-label="Pocket to fund"><SelectValue placeholder="Choose pocket" /></SelectTrigger>
                <SelectContent>
                  {sweepable.map((p) => <SelectItem key={p.pocket.id} value={p.pocket.id}>{p.pocket.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {sweepPreview && sweepPreview.monthsSaved > 0 && (
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                  finishes {sweepPreview.monthsSaved} month{sweepPreview.monthsSaved === 1 ? '' : 's'} earlier ({monthLabel(sweepPreview.after.completionMonthKey ?? '')})
                </Badge>
              )}
              {sweepPreview && (
                <Button
                  size="sm"
                  className="h-9 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    onContributionChange(effectiveTarget, sweepPreview.newContribution);
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Sweep {formatTk(headroom)}/mo
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* DPS rule */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Landmark className="h-4 w-4 text-emerald-600" /> DPS rule applied — {report.dpsRateLabel} annual</CardTitle>
          <CardDescription>Quoted from the case and reproduced exactly by integer paisa arithmetic (half-up rounding). No closed-form approximation is used anywhere.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="rounded-md bg-muted/60 p-3 text-xs italic leading-relaxed text-muted-foreground">“{dpsRule}”</p>
        </CardContent>
      </Card>

      {/* Pocket cards */}
      {report.projections.map((p) => (
        <PocketCard
          key={p.pocket.id}
          caseData={caseData}
          p={p}
          dpsRateLabel={report.dpsRateLabel}
          open={openId === p.pocket.id}
          onOpenChange={(o) => setOpenId(o ? p.pocket.id : null)}
          overridden={overridden.has(p.pocket.id)}
          onContributionChange={onContributionChange}
          onResetPocket={onResetPocket}
        />
      ))}

      {report.projections.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            This case defines no savings pockets. Load a case with pockets to see DPS projections here.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PocketCard({
  caseData,
  p,
  dpsRateLabel,
  open,
  onOpenChange,
  overridden,
  onContributionChange,
  onResetPocket,
}: {
  caseData: LedgerCase;
  p: PocketReport['projections'][number];
  dpsRateLabel: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  overridden: boolean;
  onContributionChange: (pocketId: string, bdt: string) => void;
  onResetPocket: (pocketId: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);

  const pct = p.targetPaisa > 0 ? Math.min(100, Math.round((p.monthlyPaisa / p.targetPaisa) * 100)) : 100;
  const capacity = parseBDT(caseData.pockets.find((x) => x.id === p.pocket.id)?.monthly_contribution_bdt ?? '') ?? p.monthlyPaisa;
  const draftValid = re.test(draft.trim()) && Number(draft) > 0;

  const startEdit = () => {
    setEditing(true);
    setDraft(String((parseBDT(p.pocket.monthly_contribution_bdt) ?? 0) / 100));
  };

  const save = () => {
    if (!draftValid) return;
    onContributionChange(p.pocket.id, Number(draft).toFixed(2));
    setEditing(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-emerald-600" />
              {p.pocket.name}
              <Badge variant="outline" className="font-mono text-[10px] font-normal text-muted-foreground">{p.pocket.id}</Badge>
              {overridden && <Badge className="bg-sky-100 text-[10px] text-sky-800 hover:bg-sky-100">contribution edited</Badge>}
            </CardTitle>
            <CardDescription>{p.pocket.item}</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold tabular-nums">{formatTk(p.targetPaisa)}</p>
            <p className="text-xs text-muted-foreground">target · {formatTk(p.monthlyPaisa)}/month</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {p.reachable && p.monthsNeeded !== null ? (
          <>
            <div className="grid gap-2 sm:grid-cols-4">
              <Stat label="Months to goal" value={String(p.monthsNeeded)} />
              <Stat label="Completion month" value={monthLabel(p.completionMonthKey ?? caseData.months.this)} />
              <Stat label="Total deposited" value={formatTk(p.depositedPaisa)} />
              <Stat label="DPS interest earned" value={formatTk(p.interestPaisa)} highlight />
            </div>

            {/* The derivation line — the brief forbids bare target ÷ contribution */}
            <p className="rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs leading-relaxed text-emerald-900">
              <strong>Derivation:</strong> forecast capacity {formatTk(p.monthlyPaisa)}/mo funds this pocket → ceil({formatTk(p.targetPaisa)} ÷ {formatTk(p.monthlyPaisa)}) with DPS compounding at {dpsRateLabel} p.a. → {' '}
              {p.monthsNeeded} month{p.monthsNeeded === 1 ? '' : 's'} → completion {monthLabel(p.completionMonthKey ?? caseData.months.this)}
              {p.interestAdvantageMonths !== null && p.interestAdvantageMonths > 0 ? ` (compound interest saves ${p.interestAdvantageMonths} month${p.interestAdvantageMonths === 1 ? '' : 's'} vs no-interest saving)` : ''}.
            </p>
            <p className="px-3 text-[11px] text-muted-foreground">DPS method: deposit first, then interest on the whole balance at {dpsRateLabel} p.a., half-up to the paisa — the schedule below is the audit trail.</p>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Monthly contribution covers {pct}% of target</span>
                {!editing && (
                  <span className="flex items-center gap-1.5">
                    <button onClick={startEdit} className="font-medium text-emerald-700 hover:underline">Edit contribution</button>
                    {overridden && (
                      <button onClick={() => onResetPocket(p.pocket.id)} className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground">
                        <RotateCcw className="h-3 w-3" /> case value
                      </button>
                    )}
                  </span>
                )}
              </div>
              {editing ? (
                <div className="flex items-center gap-2">
                  <div className="w-40">
                    <Label htmlFor={`contrib-${p.pocket.id}`} className="sr-only">New monthly contribution</Label>
                    <Input
                      id={`contrib-${p.pocket.id}`}
                      inputMode="decimal"
                      value={draft}
                      placeholder="BDT / month"
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && save()}
                      className={draft !== '' && !draftValid ? 'border-rose-400' : undefined}
                      autoFocus
                    />
                  </div>
                  <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700" disabled={!draftValid} onClick={save}>Apply</Button>
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditing(false)}>Cancel</Button>
                  {draft !== '' && !draftValid && <span className="text-xs text-rose-600">Positive amount, ≤ 2 decimals.</span>}
                </div>
              ) : (
                <Progress value={pct} className="h-2 transition-all duration-700 [&>div]:bg-emerald-500" aria-label={`${p.pocket.name} contribution ratio`} />
              )}
            </div>

            <Collapsible open={open} onOpenChange={onOpenChange}>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline">
                <ChevronDown className="h-3.5 w-3.5" /> Month-by-month DPS schedule ({p.schedule.length} rows — first 12 shown, full table in Audit export)
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 max-h-72 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card">
                      <TableRow>
                        <TableHead className="w-14">#</TableHead>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Opening</TableHead>
                        <TableHead className="text-right">Deposit</TableHead>
                        <TableHead className="text-right">Interest (half-up)</TableHead>
                        <TableHead className="text-right">Closing</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {p.schedule.slice(0, 12).map((r) => (
                        <TableRow key={r.n}>
                          <TableCell className="tabular-nums text-muted-foreground">{r.n}</TableCell>
                          <TableCell>{monthLabel(r.monthKey)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatTk(r.openingPaisa)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatTk(r.depositPaisa)}</TableCell>
                          <TableCell className="text-right tabular-nums text-emerald-700">{formatTk(r.interestPaisa)}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{formatTk(r.closingPaisa)}</TableCell>
                        </TableRow>
                      ))}
                      {p.schedule.length > 12 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-xs text-muted-foreground">… {p.schedule.length - 12} more months, ending {monthLabel(p.schedule[p.schedule.length - 1].monthKey)} at {formatTk(p.schedule[p.schedule.length - 1].closingPaisa)}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        ) : (
          <div className="grid gap-2">
            <p className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {p.reason}
            </p>
            {!editing && (
              <div className="flex items-center gap-2 text-xs">
                <button onClick={startEdit} className="font-medium text-emerald-700 hover:underline">Edit contribution</button>
                {overridden && (
                  <button onClick={() => onResetPocket(p.pocket.id)} className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground">
                    <RotateCcw className="h-3 w-3" /> restore case value ({formatTk(capacity)}/mo)
                  </button>
                )}
              </div>
            )}
            {editing && (
              <div className="flex items-center gap-2">
                <div className="w-40">
                  <Label htmlFor={`contrib-${p.pocket.id}`} className="sr-only">New monthly contribution</Label>
                  <Input
                    id={`contrib-${p.pocket.id}`}
                    inputMode="decimal"
                    value={draft}
                    placeholder="BDT / month"
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && draftValid && onContributionChange(p.pocket.id, Number(draft).toFixed(2))}
                    className={draft !== '' && !draftValid ? 'border-rose-400' : undefined}
                    autoFocus
                  />
                </div>
                <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700" disabled={!draftValid} onClick={() => { onContributionChange(p.pocket.id, Number(draft).toFixed(2)); setEditing(false); }}>Apply</Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-base font-bold tabular-nums ${highlight ? 'text-emerald-700' : ''}`}>{value}</p>
    </div>
  );
}
