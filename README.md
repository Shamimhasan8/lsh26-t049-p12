# TakaTrack — Personal Ledger Manager

Solution for **LofiStack Hackathon 2026 — P12 (Personal Ledger Manager)**

## Project information

- **Team:** `ReWoo`
- **Team ID:** `LSH26-T049`
- **Problem:** `P12 — Personal Ledger Manager (expense ledger · receipt-OCR review flow · forecasting · savings pockets)`
- **Live application:** <https://lsh26-t049-p12.space-z.ai/>
- **Demo video:** not supplied (optional per rules)

> Judges will evaluate only the exact commit SHA entered in the Final Submission Form.

## Solution summary

TakaTrack loads any P12 case JSON (all 25 published cases are one click away; unseen cases load by file upload or paste), tracks two months of expenses with exact integer-paisa arithmetic, and turns a receipt photo into a reviewed ledger row through a vision-model OCR flow where **a human confirms every field** before it enters the ledger. It forecasts next month's spend per category with three auditable methods and projects every savings pocket with a month-by-month DPS simulation that implements the case's exact rule: deposit first, then interest on the whole balance, rounded **half up to the paisa**. An Audit tab reproduces every number as a downloadable calculation trace so judges can verify each figure offline.

**Judge experience:** the app demos itself. A built-in **90-second Judge Tour** switches tabs and spotlights every scored requirement; a **⌘K command palette** jumps to any tab or any of the 25 cases; every mutation shows a live **“engine recomputed · X ms”** pulse plus a **“saved ✓”** chip (localStorage persistence proof); a **what-if simulator** re-derives savings and pocket completion dates from category sliders; **Savings Autopilot** sweeps unallocated forecast capacity into any pocket; and a **Requirement Map** tab points every scored bullet to the screen that proves it.

## Requirements

| Requirement | Status | Where to verify |
| --- | --- | --- |
| R1 — Expense tracking: load case fixtures, two-month ledger, category/shop/daily analytics, savings vs salary | Complete | **Ledger** tab (`/`); engine: `src/lib/p12/engine.ts` (`analyze`), money: `src/lib/p12/money.ts` |
| R2 — Receipt OCR capture with mandatory review flow (extract → review/edit → confirm) | Complete | **Capture (OCR)** tab (one-click sample receipts); server route: `src/app/api/ocr/route.ts`; review UI: `src/components/p12/capture-view.tsx` |
| R3 — Next-month spending forecast with transparent, auditable method | Complete | **Forecast** tab (three methods side-by-side + what-if simulator); engine: `forecastNextMonth` |
| R4 — Savings pockets with DPS projection per the official compounding rule (half-up to the paisa) | Complete | **Pockets** tab (derivation line + full schedule + Autopilot); engine: `projectPockets` + `dpsMonth` |
| Bonus — Determinism/auditability: validation report, calculation trace, JSON/CSV exports | Complete | **Audit & Export** tab (`buildTrace`, `buildCsv`) |
| Bonus — Full ledger CRUD: inline edit (validated) + delete with undo, overlay-based (fixture stays pristine) | Complete | Ledger register; overlay engine: `applyOverlays` in `src/lib/p12/store.ts` |
| Bonus — Insights engine: six deterministic templates naming categories and ৳ amounts, salience-ranked, recomputed on every mutation | Complete | Insights strip, Ledger tab (`buildInsights`, `detectRecurring`) |
| Bonus — Salary editing, pocket-contribution editing, recurring-payment detection (±15% rule) | Complete | Header salary chip · Pockets cards · Ledger recurring panel |
| Bonus — Judge Tour (self-guided 90-second walkthrough), ⌘K command palette, Requirement Map | Complete | Header **Judge tour** button / **Commands ⌘K** · **Requirement map** tab |

## How to test the application

1. Open the live application — case **PUB-01** loads automatically, and a banner offers the **90-second Judge Tour** (it switches tabs and spotlights each scored requirement; skippable, restartable from the header).
2. In the **Ledger** tab check the insights strip (top-3, salience-ranked), KPI cards, category table (last vs this month), daily-spend bars, recurring-payments panel and the expense register — **edit or delete any row** (delete offers **Undo**; edits persist across reloads and Reset restores the pristine fixture).
3. Open **Capture (OCR)**, click a bundled sample receipt (`public/samples/…`), press **Run OCR**, then edit any pre-filled field in the review form and press **Confirm & add to ledger** — the row appears tagged `OCR` with its **receipt thumbnail** one click away, and every KPI/insight/forecast/pocket recomputes instantly (watch the “engine recomputed · X ms” pulse).
4. Open **Forecast** — switch the method (Trend / Steady / Repeat last), then drag the **what-if sliders**: projected savings and every pocket completion date re-derive live.
5. Open **Pockets** — each pocket shows the derivation line, months-to-goal, DPS interest and the full month-by-month schedule; **edit a contribution** (dates move instantly) and use **Savings Autopilot** to sweep unallocated capacity into a pocket.
6. Press **Commands (⌘K)** — jump to any tab, load any of the 25 cases, export CSV/trace, reset.
7. Open **Audit & Export** — validation report, session mutation ledger (persistence proof), full calculation trace, and downloads: updated case JSON / trace JSON / **ledger CSV**. Finish on the **Requirement map** tab, which links every scored bullet to its proof.

### Test or sample data

- **Published fixture:** all 25 cases (`PUB-01`…`PUB-25`) are bundled — pick any from the header dropdown. The same file ships at `fixtures/P12_personal_ledger_public.json`.
- **Judge-supplied cases:** use **Load case JSON** (single case object *or* a whole fixture file with a `cases` array — the first case loads) or **Paste JSON**. Invalid input is rejected with a specific reason; non-blocking issues surface as warnings in the Audit tab.
- **Reset:** press **Reset** in the header — the current case is restored to pristine published data and captured rows are discarded.

## Run locally

### Requirements

- Node.js 20+ (or Bun 1.1+) — no database, no external services needed at runtime except the OCR endpoint's managed SDK access
- No API keys required for anything except OCR; the app degrades gracefully (manual entry) if the OCR service is unavailable

### Setup

```bash
git clone https://github.com/AdilShamim8/lsh26-t049-p12
cd lsh26-t049-p12
npm install          # or: bun install
npm run dev          # or: bun run dev  →  http://localhost:3000
```

Production build: `npm run build && npm start`. Copy `.env.example` to `.env` only if you need to override the OCR base URL; there are no secrets.

## Problem-solving approach

- **Understanding the problem:** we read the case format in the fixture's `format_note` and pinned the four deliverables (ledger, OCR review flow, forecast, pockets). The single hardest spec line was the DPS rule — deposit first, then interest on the whole balance, rounded *half up to the paisa*, interest compounding into the balance. Anything approximate (closed-form annuity, float math) would visibly drift from the rule, so we engineered for exactness instead.
- **Chosen solution:** a Next.js 16 single-page app with a pure, dependency-free finance engine. All money is held as **integer paisa**; DPS interest is computed with integer arithmetic `divRoundHalfUp(balance × rateMilli, 1200000)` which is mathematically identical to the rule's `balance × rate / 12 / 100` half-up rounding, but cannot drift. Forecasts are per-category with a documented *lumpy vs variable* rule so rent-like commitments are not inflated by daily-rate proration.
- **Most important decision:** separating the deterministic engine from the UI and from the (only) AI part — OCR. Judges can re-verify every displayed number from `engine.ts` alone, and the OCR model can never write to the ledger without a human passing the review form.
- **How we tested:** a cross-verification harness compares the TypeScript engine against an **independent Python `Decimal` reference implementation** (`ROUND_HALF_UP`) across all 25 public cases — month totals, category totals, full DPS schedules, maturity, interest, months-to-goal: all green (`scripts/verify-engine.py`). The OCR endpoint was exercised with a synthetic receipt asserting shop/date/total/category extraction including VAT-summed totals.

## Technology used

- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript, Tailwind CSS 4, shadcn/ui (New York), lucide-react icons
- **Backend:** Next.js API route (`/api/ocr`) calling the managed vision model via `z-ai-web-dev-sdk` (server-side only)
- **Database:** none — stateless by design; the loaded case + captured rows persist per-browser via `localStorage`, and everything is reproducible from the fixture
- **Deployment:** Z.ai managed preview runtime (Node.js)
- **Other material tools:** Python 3 (`Decimal`) used only in the verification harness; ESLint; no chart library (hand-rolled SVG-free bar chart for full control)

See [`LICENSES.md`](LICENSES.md) for third-party materials.

## Team contributions

| Registered member | GitHub username | Major contribution | Evidence |
| --- | --- | --- | --- |
| Adil Shamim | `AdilShamim8` | Team lead. Designed the deterministic paisa engine and DPS simulation; built the OCR review flow and API route; authored verification harness; assembled submission docs. | `src/lib/p12/*`, `src/app/api/ocr/route.ts`, `scripts/verify-engine.py`, `README.md` |
| *(add other registered members here before the Final Submission Form if applicable)* | | | |

Commit count alone does not represent contribution.

## AI usage

- **Vision model via `z-ai-web-dev-sdk` (GLM vision, managed by Z.ai)** — used **only** for receipt OCR field extraction inside `/api/ocr`. Its output is treated as a suggestion: fields land in an editable review form and a human must confirm before the row is added. Verified by testing a synthetic receipt (exact shop, date, VAT-inclusive total, category) and by the review-form guardrails (validation rejects malformed amounts/dates).
- **AI coding assistant (Z.ai GLM)** — used for scaffolding and code generation during the event window, as allowed when disclosed. The team reviewed, tested and verified all logic; the deterministic engine is additionally cross-checked against an independent Python implementation (all 25 public cases pass).
- Every other feature (ledger math, forecast, DPS projection, validation, exports) is **non-AI, deterministic code**.

## Major design decisions

- **Integer paisa everywhere** — eliminates binary-float drift; the DPS half-up rounding becomes exact integer division (`divRoundHalfUp(balance × rateMilli, 1200000)`), matching the case rule to the paisa.
- **Overlay-based mutations** — the fixture is never mutated: edits, deletions, salary and pocket overrides are reviewable overlays (`applyOverlays`), so “Reset” is byte-exact in one click and the pristine published data is always recoverable.
- **Case-date semantics** — the app uses the case's `today` / `months` (never the wall clock), so any judge case in the same shape reproduces identical numbers on any machine.
- **Human-in-the-loop OCR** — the review flow (R2) is enforced by UX and validation; the model's raw JSON is shown for transparency, and nothing enters the ledger unreviewed. Confirmed rows carry a receipt thumbnail as visible proof.
- **Three forecast methods side-by-side** — Trend / Steady / Repeat-last, with the lumpy-vs-variable full-month-equivalent rule documented, so the primary number is never a black box. The what-if simulator and Autopilot reuse the exact same pure functions — no parallel math anywhere.
- **Stateless by design** — no database to configure for judging; state persists per-browser via `localStorage` (with a visible “saved ✓” chip), and reset is trivial and byte-exact (reload the pristine fixture).
- **Graceful OCR degradation** — if the OCR service is unreachable, the review form still opens for manual entry; no feature hard-fails.

## Known limitations

- Forecast methods are heuristics by design (trend/steady/repeat); the lumpy-vs-variable rule uses a ≤2-transactions heuristic, which can misclassify an unusually quiet variable category.
- Pocket projections start from balance 0 (the case schema carries no opening balances) and assume the fixed monthly contribution continues every month from `months.this`.
- OCR accepts image files only (PNG/JPG/WEBP); very long or multi-page receipts are summarised to the grand total, not itemised beyond 5 lines.
- The 600-month safety cap on DPS simulation means unreachable pockets (contribution 0) are reported as unreachable rather than simulated indefinitely.
- Persistence is per-browser (`localStorage`); clearing site data resets to the pristine fixture.

## Repository records

- [`EVENT.md`](EVENT.md) — event start code and pre-event-material declaration
- [`evaluation-manifest.json`](evaluation-manifest.json) — structured judging evidence
- [`LICENSES.md`](LICENSES.md) — frameworks, libraries, templates and assets
