'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { BadgeCheck, Banknote, ClipboardList, Command, Compass, FileSearch, ScanLine, TrendingUp, Target, Wallet, X } from 'lucide-react';
import { CaseBar } from '@/components/p12/case-bar';
import { LedgerView } from '@/components/p12/ledger-view';
import { CaptureView } from '@/components/p12/capture-view';
import { ForecastView } from '@/components/p12/forecast-view';
import { PocketsView } from '@/components/p12/pockets-view';
import { AuditView } from '@/components/p12/audit-view';
import { MapView } from '@/components/p12/map-view';
import { JudgeTour, type TourTab } from '@/components/p12/judge-tour';
import { CommandPalette } from '@/components/p12/command-palette';
import { analyze, buildCsv, buildInsights, buildTrace, detectRecurring, forecastNextMonth, projectPockets, validateCase, type CaseExpense, type ForecastMethod, type LedgerCase } from '@/lib/p12/engine';
import { PUBLIC_CASES } from '@/lib/p12/fixtures';
import { applyOverlays, loadState, saveState, type ExpenseEdit, type PersistedState } from '@/lib/p12/store';
import { parseBDT } from '@/lib/p12/money';

type Tab = TourTab;

export default function Home() {
  const [caseData, setCaseData] = useState<LedgerCase | null>(null);
  const [added, setAdded] = useState<CaseExpense[]>([]);
  const [method, setMethod] = useState<ForecastMethod>('trend');
  const [edits, setEdits] = useState<Record<string, ExpenseEdit>>({});
  const [deleted, setDeleted] = useState<string[]>([]);
  const [salaryOverride, setSalaryOverride] = useState<string | null>(null);
  const [pocketOverrides, setPocketOverrides] = useState<Record<string, string>>({});
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [tourDone, setTourDone] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  const [hydrated, setHydrated] = useState(false);
  const [lastLoadedLabel, setLastLoadedLabel] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('ledger');
  const [tourOpen, setTourOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [salaryDraft, setSalaryDraft] = useState('');
  const [savedAtLabel, setSavedAtLabel] = useState('');
  const [pulse, setPulse] = useState({ ms: 0, key: 0 });
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- hydrate from localStorage or fall back to the first public case ----
  useEffect(() => {
    const saved = loadState();
    queueMicrotask(() => {
      if (saved?.caseData) {
        setCaseData(saved.caseData);
        setAdded(saved.added);
        setMethod(saved.method ?? 'trend');
        setEdits(saved.edits ?? {});
        setDeleted(saved.deleted ?? []);
        setSalaryOverride(saved.salaryOverride ?? null);
        setPocketOverrides(saved.pocketOverrides ?? {});
        setThumbs(saved.thumbs ?? {});
        setTourDone(saved.tourDone ?? false);
        setLastLoadedLabel('restored session');
      } else {
        const first = PUBLIC_CASES[0];
        if (first) setCaseData(structuredClone(first));
        setLastLoadedLabel('published fixture');
      }
      setHydrated(true);
    });
  }, []);

  const base = caseData;
  const merged = useMemo(
    () => (base ? applyOverlays(base, added, { edits, deleted, salaryOverride, pocketOverrides }) : null),
    [base, added, edits, deleted, salaryOverride, pocketOverrides],
  );

  // ---- every derived number, computed in one timed pass (the pulse proves reactivity) ----
  const computed = useMemo(() => {
    if (!merged) return null;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const validation = validateCase(merged).v;
    const analytics = analyze(merged);
    const forecast = forecastNextMonth(merged, method);
    const recurring = detectRecurring(merged);
    const insights = buildInsights(merged, analytics, forecast, recurring);
    const pockets = projectPockets(merged, forecast.projectedSavingsPaisa, method);
    const trace = buildTrace(merged, method) as unknown as Record<string, unknown>;
    const ms = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
    return { validation, analytics, forecast, recurring, insights, pockets, trace, ms };
  }, [merged, method]);

  // pulse state updates after render (no setState during render)
  useEffect(() => {
    if (!computed) return;
    setPulse((p) => ({ ms: computed.ms, key: p.key + 1 }));
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
  }, [computed]);

  // ---- persist on every change ----
  useEffect(() => {
    if (!hydrated || !caseData) return;
    const state: PersistedState = { caseId: caseData.case_id, caseData, added, method, edits, deleted, salaryOverride, pocketOverrides, thumbs, tourDone, savedAt: '' };
    saveState(state);
    setSavedAtLabel(new Date().toLocaleTimeString('en-GB', { hour12: false }));
  }, [caseData, added, method, edits, deleted, salaryOverride, pocketOverrides, thumbs, tourDone, hydrated]);

  const isDirty = added.length > 0 || deleted.length > 0 || Object.keys(edits).length > 0 || salaryOverride !== null || Object.keys(pocketOverrides).length > 0;

  const navigate = (tab: Tab) => setActiveTab(tab);

  // ---- case loading ----
  const pickPublic = (caseId: string) => {
    const pub = PUBLIC_CASES.find((c) => c.case_id === caseId);
    if (!pub) return;
    setCaseData(structuredClone(pub));
    setAdded([]);
    setEdits({});
    setDeleted([]);
    setSalaryOverride(null);
    setPocketOverrides({});
    setThumbs({});
    setLastLoadedLabel('published fixture');
    toast({ title: `Loaded ${caseId}`, description: `${pub.expenses.length} expenses · pristine published data.` });
  };

  const loadCase = (raw: unknown, label: string) => {
    if (raw && typeof raw === 'object' && '__invalid' in raw) {
      toast({ title: 'Could not load file', description: 'The file is not valid JSON.', variant: 'destructive' });
      return;
    }
    const arr = raw && typeof raw === 'object' && Array.isArray((raw as { cases?: unknown }).cases) ? (raw as { cases: unknown[] }).cases : [raw];
    if (arr.length > 1) {
      toast({ title: `Fixture with ${arr.length} cases detected`, description: 'Loading the first case; pick the rest from the dropdown after loading each.' });
    }
    const first = arr[0];
    const { c, v } = validateCase(first);
    if (!c || v.errors.length > 0) {
      toast({
        title: 'Case rejected',
        description: v.errors.slice(0, 3).join(' ') || 'Unknown structure.',
        variant: 'destructive',
      });
      return;
    }
    setCaseData(c);
    setAdded([]);
    setEdits({});
    setDeleted([]);
    setSalaryOverride(null);
    setPocketOverrides({});
    setThumbs({});
    setLastLoadedLabel(label);
    toast({
      title: `Loaded ${c.case_id || 'case'} from ${label}`,
      description: `${c.expenses.length} expenses · ${v.warnings.length} warning${v.warnings.length === 1 ? '' : 's'} (see Audit tab).`,
    });
  };

  const resetCase = () => {
    if (!caseData) return;
    const pub = PUBLIC_CASES.find((c) => c.case_id === caseData.case_id);
    if (pub) {
      setCaseData(structuredClone(pub));
      setLastLoadedLabel('published fixture');
      toast({ title: 'Reset complete', description: `${caseData.case_id} restored to pristine published data — every overlay removed.` });
    } else {
      setLastLoadedLabel('custom case');
      toast({ title: 'Overlays cleared', description: 'Custom case data kept; OCR additions, edits and overrides removed.' });
    }
    setAdded([]);
    setEdits({});
    setDeleted([]);
    setSalaryOverride(null);
    setPocketOverrides({});
    setThumbs({});
  };

  // ---- CRUD ----
  const addExpense = (row: CaseExpense) => {
    setAdded((prev) => [...prev, row]);
    if (row.thumb) setThumbs((prev) => ({ ...prev, [row.id]: row.thumb as string }));
    toast({ title: `Added ${row.id} — ${row.shop}`, description: `৳${row.amount_bdt} on ${row.date} (${row.category}). Ledger, forecast and pockets updated.` });
  };

  const editExpense = (id: string, patch: ExpenseEdit) => {
    setEdits((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } }));
    toast({ title: `Updated ${id}`, description: `Saved to this browser — every KPI, insight, forecast and pocket recomputed.` });
  };

  const deleteExpense = (id: string) => {
    setDeleted((prev) => (prev.includes(id) ? prev : [...prev, id]));
    toast({
      title: `Deleted ${id}`,
      description: 'The row left the ledger. All numbers recomputed.',
      action: (
        <ToastAction altText="Undo delete" onClick={() => setDeleted((prev) => prev.filter((x) => x !== id))}>
          Undo
        </ToastAction>
      ),
    });
  };

  // ---- salary & pockets ----
  const openSalaryDialog = () => {
    setSalaryDraft(merged ? String((parseBDT(merged.salary_bdt) ?? 0) / 100) : '');
    setSalaryOpen(true);
  };

  const saveSalary = () => {
    const v = salaryDraft.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(v) || Number(v) <= 0) {
      toast({ title: 'Invalid salary', description: 'Enter a positive amount with up to 2 decimals.', variant: 'destructive' });
      return;
    }
    setSalaryOverride(Number(v).toFixed(2));
    setSalaryOpen(false);
    toast({ title: `Salary set to ৳${Number(v).toLocaleString('en-IN')}`, description: 'Pace, forecast capacity and pocket dates re-derived.' });
  };

  const changeContribution = (pocketId: string, bdt: string) => {
    setPocketOverrides((prev) => ({ ...prev, [pocketId]: bdt }));
    const name = caseData?.pockets.find((p) => p.id === pocketId)?.name ?? pocketId;
    toast({ title: `${name} contribution set to ৳${Number(bdt).toLocaleString('en-IN')}/mo`, description: 'Schedule re-derived from the forecast — see the updated completion month.' });
  };

  const resetPocket = (pocketId: string) => {
    setPocketOverrides((prev) => {
      const next = { ...prev };
      delete next[pocketId];
      return next;
    });
  };

  // ---- exports ----
  const downloadBlob = (name: string, data: string, mime: string) => {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    if (!merged) return;
    downloadBlob(`${merged.case_id || 'case'}-ledger.csv`, buildCsv(merged), 'text/csv');
    toast({ title: 'CSV exported', description: `${merged.expenses.length} rows · exact paisa amounts, RFC-4180 quoting.` });
  };

  const downloadCase = () => {
    if (!merged) return;
    downloadBlob(`${merged.case_id || 'case'}-updated.json`, JSON.stringify(merged, null, 2), 'application/json');
  };

  const downloadTrace = () => {
    if (!computed) return;
    downloadBlob(`${merged?.case_id || 'case'}-trace.json`, JSON.stringify(computed.trace, null, 2), 'application/json');
  };

  const startTour = () => {
    setWelcomeDismissed(true);
    setTourOpen(true);
  };

  if (!hydrated || !caseData || !merged || !computed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-sm text-muted-foreground">Loading ledger…</p>
      </main>
    );
  }

  const { validation, analytics, forecast, recurring, insights, pockets } = computed;
  const mutationSummary = { edits: Object.keys(edits).length, deleted: deleted.length, added: added.length, savedAt: savedAtLabel };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Wallet className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">TakaTrack — Personal Ledger</h1>
              <p className="text-xs text-muted-foreground">
                LofiStack Hackathon 2026 · P12 · Team ReWoo (LSH26-T049)
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={() => setPaletteOpen(true)} title="Command palette (Ctrl/Cmd+K)">
              <Command className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Commands</span> <kbd className="ml-1 hidden rounded border bg-muted px-1 text-[10px] text-muted-foreground sm:inline">⌘K</kbd>
            </Button>
            <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700" onClick={startTour} data-tour="tour-button">
              <Compass className="h-3.5 w-3.5" /> Judge tour
            </Button>
            <CaseBar
              currentCaseId={caseData.case_id}
              caseIds={PUBLIC_CASES.map((c) => c.case_id)}
              dirty={isDirty}
              onLoadCase={loadCase}
              onPickPublic={pickPublic}
              onReset={resetCase}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4">
        {/* Welcome / tour banner */}
        {!tourDone && !welcomeDismissed && !tourOpen && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold">First time here? TakaTrack can walk you through itself.</p>
              <p className="text-xs text-muted-foreground">A 90-second guided tour of every scored requirement — it switches tabs and spotlights the proof for you.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700" onClick={startTour}>
                <Compass className="h-3.5 w-3.5" /> Start the tour
              </Button>
              <Button variant="ghost" size="sm" className="h-8" onClick={() => setWelcomeDismissed(true)} aria-label="Dismiss">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="bg-white font-normal">source: {lastLoadedLabel}</Badge>
          <Badge variant="outline" className="bg-white font-normal">today: {caseData.today} (from the case — never the system clock)</Badge>
          <Badge variant="outline" className="bg-white font-normal">window: {caseData.months.last} → {caseData.months.this}</Badge>
          {isDirty && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">edited session (overlay — Reset restores the fixture)</Badge>}
          {savedAtLabel && (
            <Badge variant="outline" className="border-emerald-200 bg-white font-normal text-emerald-700" title="Every mutation is written to this browser's localStorage instantly">
              saved ✓ {savedAtLabel}
            </Badge>
          )}
          <Badge key={pulse.key} variant="outline" className="border-sky-200 bg-white font-normal text-sky-700" title="Time for the pure-function engine to recompute every number you see">
            ⚡ engine recomputed · {pulse.ms.toFixed(2)} ms
          </Badge>
          <button onClick={openSalaryDialog} className="inline-flex items-center gap-1 rounded-md border bg-white px-2 py-0.5 font-normal hover:border-emerald-300 hover:text-emerald-700" title="Edit the monthly salary used by pace, forecast and pockets">
            <Banknote className="h-3.5 w-3.5" /> salary: ৳{(parseBDT(merged.salary_bdt) ?? 0) / 100} ✎
          </button>
          <span className="hidden sm:inline">All amounts are exact integer paisa · DPS interest rounds half-up per the case rule.</span>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)} className="gap-4">
          <TabsList className="h-9 w-full justify-start overflow-x-auto bg-white p-1 sm:w-fit">
            <TabsTrigger value="ledger" className="gap-1.5 px-3 text-xs"><ClipboardList className="h-3.5 w-3.5" /> Ledger</TabsTrigger>
            <TabsTrigger value="capture" className="gap-1.5 px-3 text-xs"><ScanLine className="h-3.5 w-3.5" /> Capture (OCR)</TabsTrigger>
            <TabsTrigger value="forecast" className="gap-1.5 px-3 text-xs"><TrendingUp className="h-3.5 w-3.5" /> Forecast</TabsTrigger>
            <TabsTrigger value="pockets" className="gap-1.5 px-3 text-xs"><Target className="h-3.5 w-3.5" /> Pockets</TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5 px-3 text-xs"><FileSearch className="h-3.5 w-3.5" /> Audit &amp; Export</TabsTrigger>
            <TabsTrigger value="map" className="gap-1.5 px-3 text-xs"><BadgeCheck className="h-3.5 w-3.5" /> Requirement map</TabsTrigger>
          </TabsList>

          <TabsContent value="ledger">
            <LedgerView caseData={merged} analytics={analytics} insights={insights} recurring={recurring} thumbs={thumbs} onEdit={editExpense} onDelete={deleteExpense} onExportCsv={exportCsv} />
          </TabsContent>
          <TabsContent value="capture"><CaptureView caseData={merged} onAdd={addExpense} /></TabsContent>
          <TabsContent value="forecast"><ForecastView caseData={merged} forecast={forecast} method={method} onMethodChange={setMethod} pocketReport={pockets} /></TabsContent>
          <TabsContent value="pockets">
            <PocketsView caseData={merged} report={pockets} method={method} onContributionChange={changeContribution} onResetPocket={resetPocket} overriddenPocketIds={Object.keys(pocketOverrides)} />
          </TabsContent>
          <TabsContent value="audit">
            <AuditView caseData={merged} validation={validation} trace={computed.trace} onDownloadCase={downloadCase} onDownloadTrace={downloadTrace} onExportCsv={exportCsv} mutationSummary={mutationSummary} />
          </TabsContent>
          <TabsContent value="map"><MapView onNavigate={navigate} caseId={merged.case_id} caseCount={PUBLIC_CASES.length} /></TabsContent>
        </Tabs>
      </main>

      <footer className="mt-auto border-t bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-muted-foreground">
          <span>TakaTrack · lsh26-t049-p12 · built for the LofiStack Hackathon 2026 event window</span>
          <span>R1 OCR review flow · R2 dashboard · R3 forecast + insights · R4 DPS pockets · ⌘K for everything</span>
        </div>
      </footer>

      <JudgeTour
        key={tourOpen ? 'tour-open' : 'tour-closed'}
        open={tourOpen}
        onOpenChange={(o) => {
          setTourOpen(o);
          if (!o) {
            setTourDone(true);
            setWelcomeDismissed(true);
          }
        }}
        onNavigate={navigate}
        onFinish={() => toast({ title: 'Tour complete', description: 'Every requirement is one tab away — the ⌘K palette is the fastest route.' })}
      />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        caseIds={PUBLIC_CASES.map((c) => c.case_id)}
        onNavigate={navigate}
        onPickCase={pickPublic}
        onStartTour={startTour}
        onExportCsv={exportCsv}
        onExportTrace={downloadTrace}
        onReset={resetCase}
      />

      {/* Salary dialog */}
      <Dialog open={salaryOpen} onOpenChange={setSalaryOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Monthly salary</DialogTitle>
            <DialogDescription>
              Used by the pace guard, forecast capacity and every pocket completion date. Changing it here overlays the case value — Reset restores the published salary.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="salary-input">Salary (BDT / month)</Label>
            <Input
              id="salary-input"
              inputMode="decimal"
              value={salaryDraft}
              onChange={(e) => setSalaryDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveSalary()}
              placeholder="e.g. 55000"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSalaryOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={saveSalary}>Save salary</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
