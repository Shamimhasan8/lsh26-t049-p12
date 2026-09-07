'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, CircleAlert, Download, FileJson2, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { paisaToBDT } from '@/lib/p12/money';
import type { LedgerCase, Validation } from '@/lib/p12/engine';

interface Props {
  caseData: LedgerCase;
  validation: Validation;
  trace: Record<string, unknown>;
  onDownloadCase: () => void;
  onDownloadTrace: () => void;
  onExportCsv: () => void;
  mutationSummary: { edits: number; deleted: number; added: number; savedAt: string };
}

export function AuditView({ caseData: c, validation, trace, onDownloadCase, onDownloadTrace, onExportCsv, mutationSummary }: Props) {
  const download = (name: string, data: unknown) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const okCount = validation.errors.length === 0;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className={`h-4 w-4 ${okCount ? 'text-emerald-600' : 'text-rose-600'}`} /> Case validation
          </CardTitle>
          <CardDescription>Rules checked on load — the same checks run for any judge-supplied case in this shape.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Field label="Case ID" value={c.case_id} />
            <Field label="Today" value={c.today} />
            <Field label="Month (last)" value={c.months.last} />
            <Field label="Month (this)" value={c.months.this} />
            <Field label="Salary" value={`৳${c.salary_bdt}`} />
            <Field label="DPS rate" value={`${c.dps_annual_rate_percent}%`} />
            <Field label="Expenses" value={String(c.expenses.length)} />
            <Field label="Pockets" value={String(c.pockets.length)} />
          </div>
          <div className="grid gap-1.5">
            {okCount ? (
              <p className="flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" /> No blocking errors — all hard constraints pass.</p>
            ) : (
              validation.errors.map((e, i) => (
                <p key={i} className="flex items-start gap-1.5 text-sm text-rose-700"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {e}</p>
              ))
            )}
            {validation.warnings.map((w, i) => (
              <p key={i} className="flex items-start gap-1.5 text-sm text-amber-700"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {w}</p>
            ))}
          </div>
          <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Determinism statement</p>
            Every number in this app comes from pure integer-paisa functions in <code>src/lib/p12/engine.ts</code> and <code>money.ts</code>. Only the receipt OCR uses AI — and its output must pass a human review step before entering the ledger. Reloading the same case always reproduces the same numbers.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><FileJson2 className="h-4 w-4 text-emerald-600" /> Exports &amp; evidence</CardTitle>
          <CardDescription>Download the working ledger or the full calculation trace for offline checking.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onDownloadCase}>
              <Download className="h-3.5 w-3.5" /> Updated case JSON
            </Button>
            <Button variant="outline" size="sm" onClick={onDownloadTrace}>
              <Download className="h-3.5 w-3.5" /> Calculation trace JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => download(`${c.case_id}-validation.json`, validation)}>
              <Download className="h-3.5 w-3.5" /> Validation report
            </Button>
            <Button variant="outline" size="sm" onClick={onExportCsv} data-tour="audit-csv">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Ledger CSV
            </Button>
          </div>
          <div className="rounded-md border bg-muted/40 p-2.5 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Session mutation ledger (proof of persistence)</p>
            <p className="mt-0.5">
              {mutationSummary.added} added · {mutationSummary.edits} edited · {mutationSummary.deleted} deleted · last saved {mutationSummary.savedAt || '—'} to this browser&apos;s localStorage. Reset returns everything to the pristine published case.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            “Updated case JSON” reproduces the official case shape with any OCR/manual rows included (marked <code>source: ocr/manual</code>) — so a judge can re-load exactly what this app shows. IDs continue the fixture numbering ({nextIdPreview(c)}).
          </p>
          <ScrollArea className="h-64 rounded-md border bg-zinc-950">
            <pre className="p-3 text-[11px] leading-relaxed text-emerald-200">{JSON.stringify(trace, null, 2)}</pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function nextIdPreview(c: LedgerCase): string {
  let max = 0;
  for (const e of c.expenses) {
    const m = /^E(\d+)$/i.exec(e.id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `E${String(max + 1).padStart(3, '0')}`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}
