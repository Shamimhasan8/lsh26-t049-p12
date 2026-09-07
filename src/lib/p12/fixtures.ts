// Bundled copies of the published public fixture so judges can load any of
// the 25 public cases in one click, and reset to pristine data at any time.
// The same files ship in /fixtures for offline verification.

import rawFixture from '@/data/P12_personal_ledger_public.json';

import type { LedgerCase } from './engine';

interface FixtureFile {
  schema_version: string;
  problem_id: string;
  format_note: string;
  cases: LedgerCase[];
}

export const FIXTURE = rawFixture as FixtureFile;
export const PUBLIC_CASES: LedgerCase[] = FIXTURE.cases;
export const FIXTURE_FORMAT_NOTE = FIXTURE.format_note;
export const FIXTURE_SCHEMA_VERSION = FIXTURE.schema_version;

export function getPublicCase(caseId: string): LedgerCase | undefined {
  return PUBLIC_CASES.find((c) => c.case_id === caseId);
}
