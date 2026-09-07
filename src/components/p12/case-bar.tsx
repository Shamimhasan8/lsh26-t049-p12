'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Database, FileUp, RotateCcw, ClipboardPaste } from 'lucide-react';
import { PUBLIC_CASES } from '@/lib/p12/fixtures';
import { extractCases } from '@/lib/p12/engine';

interface Props {
  currentCaseId: string;
  caseIds: string[]; // public case ids
  dirty: boolean;
  onLoadCase: (raw: unknown, label: string) => void;
  onPickPublic: (caseId: string) => void;
  onReset: () => void;
}

export function CaseBar({ currentCaseId, caseIds, dirty, onLoadCase, onPickPublic, onReset }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState('');

  const handleFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw: unknown = JSON.parse(String(reader.result));
        onLoadCase(raw, f.name);
      } catch {
        onLoadCase({ __invalid: true, parseError: 'File is not valid JSON' }, f.name);
      }
    };
    reader.readAsText(f);
  };

  const handlePaste = () => {
    try {
      const raw: unknown = JSON.parse(pasteText);
      setPasteError('');
      setPasteOpen(false);
      onLoadCase(raw, 'pasted JSON');
    } catch (e) {
      setPasteError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
        <Database className="h-4 w-4 text-emerald-600" aria-hidden />
        <span className="text-xs font-medium text-muted-foreground">Case</span>
        <Select value={caseIds.includes(currentCaseId) ? currentCaseId : ''} onValueChange={onPickPublic}>
          <SelectTrigger className="h-7 w-[150px] border-0 bg-transparent p-0 text-sm font-semibold shadow-none focus:ring-0" aria-label="Select a published public case">
            <SelectValue placeholder={currentCaseId || 'Custom case'} />
          </SelectTrigger>
          <SelectContent>
            {caseIds.map((id) => (
              <SelectItem key={id} value={id}>
                {id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {dirty && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800" title="This case has rows added via OCR / manual capture">
            +edited
          </span>
        )}
      </div>

      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => handleFiles(e.target.files)} aria-hidden />
      <Button variant="outline" size="sm" className="h-8" onClick={() => fileRef.current?.click()}>
        <FileUp className="h-3.5 w-3.5" /> Load case JSON
      </Button>

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <ClipboardPaste className="h-3.5 w-3.5" /> Paste JSON
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Paste a case JSON</DialogTitle>
            <DialogDescription>
              Paste one case object (same shape as the published cases) or a whole fixture file with a <code>cases</code> array.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="paste-json" className="sr-only">Case JSON</Label>
            <Textarea id="paste-json" rows={10} className="font-mono text-xs" placeholder='{ "case_id": "TEST-01", "today": "2026-04-17", ... }' value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
            {pasteError && <p className="text-xs text-rose-600">{pasteError}</p>}
          </div>
          <DialogFooter>
            <Button onClick={handlePaste} disabled={!pasteText.trim()}>Load pasted JSON</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button variant="ghost" size="sm" className="h-8" onClick={onReset} title="Restore the pristine published case (discard OCR additions)">
        <RotateCcw className="h-3.5 w-3.5" /> Reset
      </Button>
    </div>
  );
}

export { extractCases };
