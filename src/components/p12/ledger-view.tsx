'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Lightbulb, Pencil, Repeat2, ScanText, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { formatTk, parseBDT } from '@/lib/p12/money';
import { KNOWN_CATEGORIES, monthLabel, RECURRING_TOLERANCE_PCT, type Analytics, type CaseExpense, type Insight, type LedgerCase, type RecurringRow } from '@/lib/p12/engine';
import type { ExpenseEdit } from '@/lib/p12/store';

interface Props {
  caseData: LedgerCase;
  analytics: Analytics;
  insights: Insight[];
  recurring: RecurringRow[];
  thumbs: Record<string, string>;
  onEdit: (id: string, patch: ExpenseEdit) => void;
  onDelete: (id: string) => void;
  onExportCsv: () => void;
}

type MonthFilter = 'this' | 'last' | 'all';

const ALL_CATEGORIES = [...KNOWN_CATEGORIES, 'Other'];

export function LedgerView({ caseData, analytics: a, insights, recurring, thumbs, onEdit, onDelete, onExportCsv }: Props) {
  const [filter, setFilter] = useState<MonthFilter>('this');
  const [editing, setEditing] = useState<CaseExpense | null>(null);

  const rows = useMemo(() => {
    const list = [...caseData.expenses];
    if (filter === 'this') return list.filter((e) => e.date.slice(0, 7) === caseData.months.this).sort((x, y) => y.date.localeCompare(x.date) || y.amount_bdt.localeCompare(x.amount_bdt, undefined, { numeric: true }));
    if (filter === 'last') return list.filter((e) => e.date.slice(0, 7) === caseData.months.last).sort((x, y) => y.date.localeCompare(x.date));
    return list.sort((x, y) => y.date.localeCompare(x.date));
  }, [caseData, filter]);

  const maxDay = Math.max(1, ...a.daily.map((d) => d.paisa));
  const delta = a.totalThis - a.totalLast;
  const deltaPct = a.totalLast > 0 ? Math.round((delta / a.totalLast) * 1000) / 10 : null;
  const recurringMonthly = recurring.reduce((s, r) => s + r.monthlyAvgPaisa, 0);

  const topInsights = insights.slice(0, 3);

  return (
    <div className="grid gap-4">
      {/* Insights strip — recomputed on every mutation */}
      <div data-tour="insights" className="grid gap-3 md:grid-cols-3">
        {topInsights.map((ins) => (
          <Card key={ins.id} className={ins.tone === 'warn' ? 'border-amber-200' : ins.tone === 'good' ? 'border-emerald-200' : undefined}>
            <CardContent className="flex items-start gap-2.5 p-3.5">
              <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${ins.tone === 'warn' ? 'bg-amber-100 text-amber-700' : ins.tone === 'good' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-foreground/70'}`}>
                {ins.icon === 'shortfall' || ins.icon === 'pace' ? <TrendingDown className="h-4 w-4" /> : ins.icon === 'outlook' ? <TrendingUp className="h-4 w-4" /> : <Lightbulb className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{INSIGHT_LABEL[ins.icon] ?? 'Insight'}</p>
                <p className="mt-0.5 text-xs leading-relaxed">{ins.text}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {topInsights.length === 0 && (
          <Card className="md:col-span-3"><CardContent className="p-3.5 text-sm text-muted-foreground">No expenses in this case window yet — add one below and insights will appear.</CardContent></Card>
        )}
      </div>

      {/* KPI row */}
      <div data-tour="kpi-row" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={`Spent — ${monthLabel(caseData.months.last)}`} value={formatTk(a.totalLast)} sub={`${a.countLast} expenses · saved ${formatTk(a.savedLastPaisa, { compact: true })} (${a.savingsRateLastPct}%)`} />
        <KpiCard label={`Spent — ${monthLabel(caseData.months.this)} (to day ${a.daysElapsed})`} value={formatTk(a.totalThis)} sub={`${a.countThis} expenses · saved ${formatTk(a.savedThisPaisa, { compact: true })} (${a.savingsRateThisPct}%)`} accent={delta < 0 ? 'good' : delta > 0 ? 'warn' : undefined} badge={deltaPct !== null ? `${delta > 0 ? '+' : '−'}${Math.abs(deltaPct)}% vs last` : undefined} />
        <KpiCard label="Daily run-rate (this month)" value={formatTk(a.avgDailyThisPaisa)} sub={`over ${a.daysElapsed} day${a.daysElapsed === 1 ? '' : 's'} · ${a.daysLeft} day${a.daysLeft === 1 ? '' : 's'} left`} />
        <KpiCard label="Salary (monthly)" value={formatTk(a.salaryPaisa)} sub={`avg expense ${formatTk(a.avgExpensePaisa, { compact: true })} · largest ${a.largestExpense ? formatTk(parseBDT(a.largestExpense.amount_bdt) ?? 0, { compact: true }) : '—'}`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        {/* Category table */}
        <Card className="xl:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Spending by category</CardTitle>
            <CardDescription>{monthLabel(caseData.months.last)} vs {monthLabel(caseData.months.this)} — exact paisa totals, half-up rounding</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">{monthLabel(caseData.months.last)}</TableHead>
                  <TableHead className="text-right">{monthLabel(caseData.months.this)}</TableHead>
                  <TableHead className="text-right">Δ</TableHead>
                  <TableHead className="w-[90px]">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {a.categories.map((r) => (
                  <TableRow key={r.category}>
                    <TableCell className="font-medium">{r.category}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{formatTk(r.lastPaisa)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{formatTk(r.thisPaisa)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${r.deltaPaisa > 0 ? 'text-rose-600' : r.deltaPaisa < 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                      {r.deltaPaisa === 0 ? '—' : formatTk(r.deltaPaisa, { signed: true })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Progress value={Math.min(100, r.sharePct)} className="h-1.5 [&>div]:bg-emerald-500" aria-label={`${r.category} share ${r.sharePct}%`} />
                        <span className="w-9 text-right text-[10px] tabular-nums text-muted-foreground">{r.sharePct}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{formatTk(a.totalLast)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatTk(a.totalThis)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${delta > 0 ? 'text-rose-600' : delta < 0 ? 'text-emerald-600' : ''}`}>{formatTk(delta, { signed: true })}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Daily bars + top shops + recurring */}
        <div className="grid content-start gap-4 xl:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Daily spend — {monthLabel(caseData.months.this)}</CardTitle>
              <CardDescription>days 1–{a.daysInThis}; today is day {a.daysElapsed}</CardDescription>
            </CardHeader>
            <CardContent>
              <TooltipProvider delayDuration={80}>
                <div className="flex h-28 items-end gap-[2px]" role="img" aria-label="Bar chart of daily spending for this month">
                  {a.daily.map((d) => {
                    const h = d.paisa === 0 ? 2 : Math.max(3, Math.round((d.paisa / maxDay) * 100));
                    const future = d.day > a.daysElapsed;
                    return (
                      <Tooltip key={d.day}>
                        <TooltipTrigger asChild>
                          <div
                            className={`flex-1 rounded-t-[2px] ${future ? 'bg-muted' : d.paisa === 0 ? 'bg-emerald-200' : 'bg-emerald-500/85 hover:bg-emerald-600'}`}
                            style={{ height: `${future ? 2 : h}%` }}
                          />
                        </TooltipTrigger>
                        <TooltipContent className="px-2 py-1 text-xs">
                          Day {d.day}: {formatTk(d.paisa)}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
              <p className="mt-2 text-xs text-muted-foreground">Peak day {a.daily.reduce((b, d) => (d.paisa > b.paisa ? d : b), a.daily[0] ?? { day: 0, paisa: 0 }).day} · grey bars are future days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-base"><Repeat2 className="h-4 w-4 text-emerald-600" /> Recurring payments</CardTitle>
              <CardDescription>same shop in both months · amounts within ±{RECURRING_TOLERANCE_PCT}%</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {recurring.slice(0, 5).map((r) => (
                <div key={r.shop} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{r.shop}</div>
                    <div className="text-[11px] text-muted-foreground">{r.category} · {r.count} payments · spread ±{r.spreadPct}%</div>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatTk(r.monthlyAvgPaisa)}<span className="text-[10px] font-normal text-muted-foreground">/mo</span></span>
                </div>
              ))}
              {recurring.length === 0 && <p className="text-sm text-muted-foreground">No shop repeats in both months within tolerance.</p>}
              {recurring.length > 0 && (
                <p className="mt-1 rounded-md bg-muted/60 p-2 text-[11px] text-muted-foreground">
                  Committed recurring load: <strong className="text-foreground">{formatTk(recurringMonthly)}</strong>/mo — rule: normalised shop present in both case months, every amount within ±{RECURRING_TOLERANCE_PCT}% of the two-month mean.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Expense register with full CRUD */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <div>
            <CardTitle className="text-base">Expense register</CardTitle>
            <CardDescription>
              {rows.length} row{rows.length === 1 ? '' : 's'} · edit or delete any row — the pristine case stays untouched underneath
              {a.otherMonthCount > 0 && ` · ${a.otherMonthCount} row(s) outside both case months counted under "all" only`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={onExportCsv}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as MonthFilter)}>
              <TabsList className="h-8">
                <TabsTrigger value="this" className="h-6 px-2 text-xs">{monthLabel(caseData.months.this)}</TabsTrigger>
                <TabsTrigger value="last" className="h-6 px-2 text-xs">{monthLabel(caseData.months.last)}</TabsTrigger>
                <TabsTrigger value="all" className="h-6 px-2 text-xs">All</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <div data-tour="register" className="max-h-96 overflow-y-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="w-[86px]">ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Shop</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[86px]">Source</TableHead>
                  <TableHead className="w-[76px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => (
                  <TableRow key={`${e.id}-${e.date}`}>
                    <TableCell className="font-mono text-xs">{e.id}</TableCell>
                    <TableCell className="whitespace-nowrap">{e.date}</TableCell>
                    <TableCell><Badge variant="outline" className="font-normal">{e.category}</Badge></TableCell>
                    <TableCell className="max-w-[220px] truncate">{e.shop}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatTk(parseBDT(e.amount_bdt) ?? 0)}</TableCell>
                    <TableCell>
                      {e.source === 'ocr' || thumbs[e.id] ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-200" title="View the receipt this row came from">
                              <ScanText className="h-3 w-3" /> OCR
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-2" align="end">
                            {thumbs[e.id] ? (
                              <img src={thumbs[e.id]} alt={`Receipt for ${e.id}`} className="max-h-56 w-full rounded border object-contain" />
                            ) : (
                              <p className="p-2 text-xs text-muted-foreground">Receipt thumbnail not stored for this row.</p>
                            )}
                            {e.ocr_confidence !== undefined && (
                              <p className="px-1 pt-1.5 text-[11px] text-muted-foreground">OCR confidence {(e.ocr_confidence * 100).toFixed(0)}% · reviewed by a human before saving</p>
                            )}
                          </PopoverContent>
                        </Popover>
                      ) : e.source === 'manual' ? (
                        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Manual</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">fixture</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditing(e)} aria-label={`Edit ${e.id}`}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="px-2 py-1 text-xs">Edit {e.id}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => onDelete(e.id)} aria-label={`Delete ${e.id}`}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="px-2 py-1 text-xs">Delete {e.id} (undo from toast)</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No expenses for this filter — add one via Capture (OCR) or edit a fixture row.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit dialog — remounted per row so fields always seed fresh */}
      {editing && (
        <EditDialog
          key={`${editing.id}-${editing.amount_bdt}-${editing.date}`}
          expense={editing}
          today={caseData.today}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            onEdit(editing.id, patch);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

const INSIGHT_LABEL: Partial<Record<Insight['icon'], string>> = {
  'top-category': 'Top category',
  pace: 'Pace guard',
  outlook: 'Month-end outlook',
  shortfall: 'Shortfall alert',
  largest: 'Largest expense',
  mom: 'Biggest move',
  recurring: 'Recurring load',
};

function EditDialog({ expense, today, onClose, onSave }: { expense: CaseExpense; today: string; onClose: () => void; onSave: (patch: ExpenseEdit) => void }) {
  const initialPaisa = parseBDT(expense.amount_bdt) ?? 0;
  const [date, setDate] = useState(expense.date);
  const [category, setCategory] = useState(ALL_CATEGORIES.includes(expense.category) ? expense.category : 'Other');
  const [shop, setShop] = useState(expense.shop);
  const [amount, setAmount] = useState(initialPaisa === 0 ? '' : String(initialPaisa / 100));
  const [touched, setTouched] = useState(false);

  const amountRe = /^\d+(\.\d{1,2})?$/;
  const amountValid = amountRe.test(amount.trim()) && Number(amount) > 0;
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today;
  const shopValid = shop.trim().length > 0;
  const canSave = amountValid && dateValid && shopValid;

  return (
    <Dialog open onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {expense.id}</DialogTitle>
          <DialogDescription>
            Changes apply instantly everywhere (KPIs, forecast, pockets) and persist in this browser. Date must not be after the case&apos;s “today” ({today}).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-date">Date *</Label>
              <Input id="edit-date" type="date" value={date} max={today} onChange={(e) => { setTouched(true); setDate(e.target.value); }} className={touched && !dateValid ? 'border-rose-400' : ''} />
              {!dateValid && <p className="text-xs text-rose-600">Required, ≤ {today}.</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-amount">Amount (BDT) *</Label>
              <Input id="edit-amount" inputMode="decimal" value={amount} placeholder="e.g. 1240.50" onChange={(e) => { setTouched(true); setAmount(e.target.value); }} className={touched && amount !== '' && !amountValid ? 'border-rose-400' : ''} />
              {!amountValid && amount !== '' && <p className="text-xs text-rose-600">Positive, up to 2 decimals.</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-category">Category *</Label>
              <Select value={category} onValueChange={(v) => setCategory(v)}>
                <SelectTrigger id="edit-category" aria-label="Category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-shop">Shop *</Label>
              <Input id="edit-shop" value={shop} onChange={(e) => setShop(e.target.value)} placeholder="Shop name" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={!canSave} onClick={() => onSave({ date, category, shop: shop.trim(), amount_bdt: Number(amount).toFixed(2) })}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KpiCard({ label, value, sub, badge, accent }: { label: string; value: string; sub?: string; badge?: string; accent?: 'good' | 'warn' }) {
  return (
    <Card className={accent === 'good' ? 'border-emerald-200' : accent === 'warn' ? 'border-amber-200' : undefined}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {badge && <Badge variant="outline" className={`shrink-0 text-[10px] ${accent === 'good' ? 'border-emerald-300 text-emerald-700' : accent === 'warn' ? 'border-amber-300 text-amber-700' : ''}`}>{badge}</Badge>}
        </div>
        <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
