'use client';

// ⌘K command palette — keyboard-first control for judges and power users:
// jump to any tab, load any of the 25 published cases, start the tour,
// export data, reset. Triggered from the header button or Ctrl/Cmd+K.

import { useEffect } from 'react';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { BadgeCheck, Compass, Database, FileDown, FileJson2, LayoutDashboard, RotateCcw, ScanLine, Sigma, Target } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseIds: string[];
  onNavigate: (tab: 'ledger' | 'capture' | 'forecast' | 'pockets' | 'audit' | 'map') => void;
  onPickCase: (caseId: string) => void;
  onStartTour: () => void;
  onExportCsv: () => void;
  onExportTrace: () => void;
  onReset: () => void;
}

export function CommandPalette({ open, onOpenChange, caseIds, onNavigate, onPickCase, onStartTour, onExportCsv, onExportTrace, onReset }: Props) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  const run = (fn: () => void) => {
    onOpenChange(false);
    // let the dialog close before performing the action (some actions switch tabs)
    setTimeout(fn, 30);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command or search cases…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => run(() => onNavigate('ledger'))}>
            <LayoutDashboard className="mr-2 h-4 w-4 text-emerald-600" /> Ledger &amp; insights <span className="ml-auto text-xs text-muted-foreground">R2 · R3</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => onNavigate('capture'))}>
            <ScanLine className="mr-2 h-4 w-4 text-emerald-600" /> Capture (OCR review flow) <span className="ml-auto text-xs text-muted-foreground">R1</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => onNavigate('forecast'))}>
            <Sigma className="mr-2 h-4 w-4 text-emerald-600" /> Forecast &amp; what-if <span className="ml-auto text-xs text-muted-foreground">R3</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => onNavigate('pockets'))}>
            <Target className="mr-2 h-4 w-4 text-emerald-600" /> Savings pockets &amp; DPS <span className="ml-auto text-xs text-muted-foreground">R4</span>
          </CommandItem>
          <CommandItem onSelect={() => run(() => onNavigate('audit'))}>
            <FileJson2 className="mr-2 h-4 w-4 text-emerald-600" /> Audit &amp; exports
          </CommandItem>
          <CommandItem onSelect={() => run(() => onNavigate('map'))}>
            <BadgeCheck className="mr-2 h-4 w-4 text-emerald-600" /> Requirement map
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(onStartTour)}>
            <Compass className="mr-2 h-4 w-4 text-emerald-600" /> Start the 90-second judge tour
          </CommandItem>
          <CommandItem onSelect={() => run(onExportCsv)}>
            <FileDown className="mr-2 h-4 w-4" /> Export ledger as CSV
          </CommandItem>
          <CommandItem onSelect={() => run(onExportTrace)}>
            <FileJson2 className="mr-2 h-4 w-4" /> Download calculation trace JSON
          </CommandItem>
          <CommandItem onSelect={() => run(onReset)}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reset to pristine published case
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading={`Load published case (${caseIds.length} official)`}>
          {caseIds.map((id) => (
            <CommandItem key={id} value={`load ${id}`} onSelect={() => run(() => onPickCase(id))}>
              <Database className="mr-2 h-4 w-4 text-muted-foreground" /> {id}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

