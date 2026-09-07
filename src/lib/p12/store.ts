// Client-side persistence (v2): the loaded case, rows added via OCR/manual,
// inline edits, deletions, salary override, pocket contribution overrides and
// receipt thumbnails all survive a page reload (per browser). "Reset" always
// returns to the pristine published case. No server-side state — judges always
// start from the official fixture data, and every mutation is saved instantly.

'use client';

import type { CaseExpense, LedgerCase } from './engine';

const KEY = 'p12-t049-state-v2';
const LEGACY_KEY = 'p12-t049-state-v1';

/** A single-field edit applied on top of any expense row (fixture or added). */
export interface ExpenseEdit {
  date?: string;
  category?: string;
  shop?: string;
  amount_bdt?: string;
}

export interface PersistedState {
  caseId: string;
  caseData: LedgerCase;
  added: CaseExpense[];
  method: 'trend' | 'steady' | 'last';
  savedAt: string;
  /** edits keyed by expense id — the fixture stays pristine, edits are overlaid */
  edits?: Record<string, ExpenseEdit>;
  /** ids of rows deleted through the register */
  deleted?: string[];
  /** salary override (BDT string) — editable income for Live exploration */
  salaryOverride?: string | null;
  /** pocket contribution overrides keyed by pocket id (BDT strings) */
  pocketOverrides?: Record<string, string>;
  /** receipt thumbnails keyed by expense id (small data URLs) */
  thumbs?: Record<string, string>;
  /** tour / first-visit flags */
  tourDone?: boolean;
}

export function loadState(): PersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY) ?? window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed || typeof parsed !== 'object' || !parsed.caseData || !Array.isArray(parsed.added)) return null;
    return {
      ...parsed,
      edits: parsed.edits ?? {},
      deleted: parsed.deleted ?? [],
      pocketOverrides: parsed.pocketOverrides ?? {},
      thumbs: parsed.thumbs ?? {},
    };
  } catch {
    return null;
  }
}

export function saveState(s: PersistedState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...s, savedAt: new Date().toISOString() }));
  } catch {
    // storage full / private mode — the app still works, just without persistence
  }
}

export function clearState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
}

/** Merge added rows into a pristine case (for exports and for hydration). */
export function withAdded(base: LedgerCase, added: CaseExpense[]): LedgerCase {
  if (added.length === 0) return base;
  return { ...base, expenses: [...base.expenses, ...added] };
}

/**
 * Overlay the full mutation set onto the pristine case:
 * deletions, single-field edits, salary override and pocket contribution
 * overrides. The pristine published case is never mutated — every change is a
 * reviewable overlay that "Reset" removes in one click.
 */
export function applyOverlays(
  base: LedgerCase,
  added: CaseExpense[],
  opts: { edits?: Record<string, ExpenseEdit>; deleted?: string[]; salaryOverride?: string | null; pocketOverrides?: Record<string, string> } = {},
): LedgerCase {
  const edits = opts.edits ?? {};
  const deleted = new Set(opts.deleted ?? []);
  let expenses = [...base.expenses, ...added]
    .filter((e) => !deleted.has(e.id))
    .map((e) => {
      const ed = edits[e.id];
      if (!ed) return e;
      return {
        ...e,
        ...(ed.date !== undefined ? { date: ed.date } : {}),
        ...(ed.category !== undefined ? { category: ed.category } : {}),
        ...(ed.shop !== undefined ? { shop: ed.shop } : {}),
        ...(ed.amount_bdt !== undefined ? { amount_bdt: ed.amount_bdt } : {}),
        ...(ed.amount_bdt !== undefined && e.source === undefined ? { source: 'manual' as const } : {}),
      };
    });
  // de-duplicate by id (paranoia: keeps CSV/JSON exports clean)
  const seen = new Set<string>();
  expenses = expenses.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
  return {
    ...base,
    salary_bdt: opts.salaryOverride ?? base.salary_bdt,
    pockets: base.pockets.map((p) => {
      const ov = opts.pocketOverrides?.[p.id];
      return ov !== undefined ? { ...p, monthly_contribution_bdt: ov } : p;
    }),
    expenses,
  };
}
