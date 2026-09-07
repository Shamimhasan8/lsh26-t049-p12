'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Camera, ChevronDown, ImageUp, Loader2, ScanLine, TriangleAlert, CheckCircle2, PencilLine } from 'lucide-react';
import { KNOWN_CATEGORIES, nextExpenseId, type CaseExpense, type LedgerCase } from '@/lib/p12/engine';

interface OcrFields {
  shop: string | null;
  date: string | null;
  amount_bdt: string | null;
  category: string;
  items: string[];
  confidence: number;
  notes: string;
}

interface Props {
  caseData: LedgerCase;
  onAdd: (row: CaseExpense) => void;
}

type Phase = 'idle' | 'ocr' | 'review';

export function CaptureView({ caseData, onAdd }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState('');
  const [fields, setFields] = useState<OcrFields | null>(null);
  const [raw, setRaw] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // review form
  const [shop, setShop] = useState('');
  const [date, setDate] = useState(caseData.today);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('Other');

  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setApiError('Please choose an image file (PNG, JPG, WEBP…).');
      return;
    }
    setApiError('');
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(String(reader.result));
      setPhase('idle');
      setFields(null);
      setRaw('');
    };
    reader.readAsDataURL(file);
  }, []);

  // clipboard paste of an image
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
      if (item) {
        const f = item.getAsFile();
        if (f) readFile(f);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [readFile]);

  const runOcr = async () => {
    if (!imageDataUrl) return;
    setBusy(true);
    setApiError('');
    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl }),
      });
      const data = (await res.json()) as { ok: boolean; fields: OcrFields | null; raw?: string; error?: string };
      if (!data.ok) {
        setApiError(data.error || 'OCR failed.');
      } else {
        setRaw(data.raw ?? '');
        setFields(data.fields);
        const f = data.fields;
        setShop(f?.shop ?? '');
        setDate(f?.date ?? caseData.today);
        setAmount(f?.amount_bdt ?? '');
        setCategory(normaliseCategory(f?.category));
        setPhase('review');
      }
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Network error during OCR.');
    } finally {
      setBusy(false);
    }
  };

  const amountValid = /^\d+(\.\d{1,2})?$/.test(amount.trim()) && Number(amount) > 0;
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= caseData.today;
  const monthWarning = dateValid && date.slice(0, 7) !== caseData.months.this && date.slice(0, 7) !== caseData.months.last;
  const canConfirm = shop.trim().length > 0 && amountValid && dateValid && category.trim().length > 0;

  const confirm = () => {
    if (!canConfirm) return;
    const row: CaseExpense = {
      id: nextExpenseId(caseData),
      date,
      category,
      shop: shop.trim(),
      amount_bdt: Number(amount).toFixed(2),
      source: 'ocr',
      ...(fields ? { ocr_confidence: Math.round(fields.confidence * 100) / 100 } : {}),
      ...(thumbDataUrl ? { thumb: thumbDataUrl } : {}),
    };
    onAdd(row);
    // reset flow for the next receipt
    setImageDataUrl(null);
    setFields(null);
    setRaw('');
    setPhase('idle');
    setShop('');
    setAmount('');
    setCategory('Other');
    setDate(caseData.today);
    setThumbDataUrl(null);
  };

  /** Downscale the confirmed receipt into a small thumbnail stored with the row. */
  const makeThumb = useCallback((dataUrl: string, cb: (thumb: string | null) => void) => {
    try {
      const img = new Image();
      img.onload = () => {
        const maxW = 140;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return cb(null);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        cb(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => cb(null);
      img.src = dataUrl;
    } catch {
      cb(null);
    }
  }, []);

  // hold the thumbnail until confirm; kept in sync with the loaded image
  const [thumbDataUrl, setThumbDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!imageDataUrl) {
      setThumbDataUrl(null);
      return;
    }
    makeThumb(imageDataUrl, (t) => setThumbDataUrl(t));
  }, [imageDataUrl, makeThumb]);

  const loadSample = async (src: string) => {
    setApiError('');
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = () => {
        setImageDataUrl(String(reader.result));
        setPhase('idle');
        setFields(null);
        setRaw('');
      };
      reader.readAsDataURL(blob);
    } catch {
      setApiError('Could not load the sample receipt.');
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      {/* Step 1 — image */}
      <Card className="xl:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Camera className="h-4 w-4 text-emerald-600" /> Step 1 — Capture receipt</CardTitle>
          <CardDescription>Upload, drag-drop or paste (Ctrl+V) a receipt photo. Nothing is stored server-side.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} aria-hidden />
          <div data-tour="capture-samples" className="grid gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Try a sample receipt (one click — exercises the full OCR review flow):</p>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLES.map((s) => (
                <Button key={s.src} variant="outline" size="sm" className="h-7 text-xs" disabled={busy} onClick={() => loadSample(s.src)}>
                  {s.label}
                </Button>
              ))}
            </div>
          </div>
          {imageDataUrl ? (
            <div className="grid gap-3">
              <img src={imageDataUrl} alt="Receipt preview" className="max-h-72 w-full rounded-lg border object-contain" />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <ImageUp className="h-3.5 w-3.5" /> Replace
                </Button>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={runOcr} disabled={busy}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanLine className="h-3.5 w-3.5" />}
                  {busy ? 'Reading receipt…' : 'Run OCR'}
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) readFile(f);
              }}
              className={`flex h-56 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-center transition-colors ${dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-muted-foreground/25 hover:border-emerald-400 hover:bg-emerald-50/40'}`}
              aria-label="Upload a receipt image"
            >
              <ImageUp className="h-8 w-8 text-emerald-600" aria-hidden />
              <span className="text-sm font-medium">Click, drop or paste a receipt image</span>
              <span className="text-xs text-muted-foreground">PNG · JPG · WEBP — the vision model reads it server-side</span>
            </button>
          )}
          {apiError && (
            <p className="flex items-start gap-1.5 rounded-md bg-rose-50 p-2 text-xs text-rose-700" role="alert">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {apiError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Step 2 — review */}
      <Card className="xl:col-span-3">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><PencilLine className="h-4 w-4 text-emerald-600" /> Step 2 — Review &amp; confirm</CardTitle>
          <CardDescription>OCR output is a suggestion: a human checks every field before it enters the ledger (the required review flow).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {phase !== 'review' && (
            <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
              {busy ? (
                <>
                  <Loader2 className="mb-2 h-5 w-5 animate-spin text-emerald-600" />
                  Extracting shop, date, total and category…
                </>
              ) : (
                'Run OCR on a receipt to fill this review form.'
              )}
            </div>
          )}

          {phase === 'review' && fields && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={fields.confidence >= 0.8 ? 'default' : 'secondary'} className={fields.confidence >= 0.8 ? 'bg-emerald-600' : ''}>
                  Model confidence {(fields.confidence * 100).toFixed(0)}%
                </Badge>
                <Progress value={fields.confidence * 100} className="h-1.5 w-28 [&>div]:bg-emerald-500" aria-hidden />
                {fields.notes && <span className="text-xs text-muted-foreground">“{fields.notes}”</span>}
              </div>

              {fields.items.length > 0 && (
                <div className="rounded-md bg-muted/60 p-2 text-xs">
                  <p className="mb-1 font-medium text-muted-foreground">Items the model read:</p>
                  <ul className="list-inside list-disc space-y-0.5">
                    {fields.items.map((it, i) => <li key={i}>{it}</li>)}
                  </ul>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="ocr-shop">Shop *</Label>
                  <Input id="ocr-shop" value={shop} onChange={(e) => setShop(e.target.value)} placeholder="e.g. Meena Bazar" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ocr-date">Date * (≤ {caseData.today})</Label>
                  <Input id="ocr-date" type="date" value={date} max={caseData.today} onChange={(e) => setDate(e.target.value)} className={dateValid ? '' : 'border-rose-400'} />
                  {monthWarning && <p className="text-xs text-amber-600">Outside both case months — it will be counted under “All” only.</p>}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ocr-amount">Amount (BDT) *</Label>
                  <Input id="ocr-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1234.50" className={amount && !amountValid ? 'border-rose-400' : ''} />
                  {!amountValid && amount !== '' && <p className="text-xs text-rose-600">Enter a positive amount with up to 2 decimals.</p>}
                </div>
                <div className="grid gap-1.5">
                  <Label>Category *</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger aria-label="Expense category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ALL_CATEGORIES.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={confirm} disabled={!canConfirm}>
                  <CheckCircle2 className="h-4 w-4" /> Confirm &amp; add to ledger
                </Button>
                <Button variant="outline" onClick={runOcr} disabled={busy}>Re-run OCR</Button>
                <span className="text-xs text-muted-foreground">Adds as <code>{nextExpenseId(caseData)}</code>, tagged source=OCR.</span>
              </div>

              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <ChevronDown className="h-3.5 w-3.5" /> What the model returned (raw JSON)
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-zinc-950 p-3 text-[11px] leading-relaxed text-emerald-200">{raw || '—'}</pre>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const ALL_CATEGORIES = [...KNOWN_CATEGORIES, 'Other'];

const SAMPLES = [
  { label: 'Grocery print', src: '/samples/receipt-grocery.png' },
  { label: 'Cafe thermal', src: '/samples/receipt-cafe.png' },
  { label: 'Mobile recharge', src: '/samples/receipt-recharge.png' },
];

function normaliseCategory(c: string | undefined): string {
  if (!c) return 'Other';
  const hit = ALL_CATEGORIES.find((k) => k.toLowerCase() === c.trim().toLowerCase());
  return hit ?? 'Other';
}
