# Probable — v1 Architecture

Status: **DRAFT for Stage A review** (Claude, 2026-08-30). Codex: every section needs
"agree" or a concrete objection + alternative. Product-intent answers from joseleos are
recorded in `docs/DECISIONS.md`; assumptions I made beyond those are marked **[assumed]**.

## 1. Problem statement

Every site-civil / land-development project produces an Engineer's Opinion of Probable
Construction Cost (OPCC) at each design milestone (30/60/90/100%). Engineers build it by
hand in Excel: re-key quantities from the Civil 3D takeoff, hunt for current unit prices,
reformat the exhibit, and redo all of it at the next milestone with no clean view of what
changed. OPCCs are explicitly non-binding "opinions", which is exactly why the work is
treated as low-value drudgery but still has to look professional and defensible.

Verbatim practitioner quotes: **none yet** (see `research/OPPORTUNITY_SCAN_2026-08-30.md`,
"Open gaps"). joseleos is sourcing engineers to interview. This section gets the quotes
pasted in verbatim when they land; until then the spec is the workflow description above.

Audience: site-civil / land-development PEs at 1–25-person firms, Texas first.

## 2. v1 scope

In scope:
- S1 Firm workspace with multiple members (invite by email, single role: member). **[assumed: one role, no admin/member split]**
- S2 Projects, each with one or more **milestone estimates** (30/60/90/100%, plus "custom").
- S3 Line-item entry: manual grid entry, paste-from-clipboard (TSV), and CSV/XLSX import with column mapping.
- S4 Unit-price library: (a) seeded **TxDOT average low-bid unit prices** (public), (b) firm-private price library that overrides the seed. Each line item links to a price entry or carries a manual price with a "manual" flag.
- S5 LLM assist: classify free-text imported descriptions to a price-library item (Claude API), with confidence; user confirms/overrides. Never auto-commits a price without a mapping the user has seen.
- S6 Estimate math: quantity × unit price, per-section subtotals, contingency % (per estimate), total. Deterministic, server-side, tested to the cent.
- S7 **Delta view**: compare any two milestones of a project — added / removed / quantity-changed / price-changed items and the total swing.
- S8 Exhibit export: PDF and XLSX. Firm logo, project header, itemized table with sections, contingency, total, non-binding disclaimer text (firm-editable default).
- S9 Privacy statement page covering LLM use.

Explicit non-goals for v1:
- PDF plan-sheet parsing / any CAD or drawing ingestion.
- Payments, plans, trials.
- CSI MasterFormat / AACE class labelling.
- Licensed price sources (RSMeans etc.).
- Public sign-up, email verification flows beyond magic link. **[assumed]**
- Mobile layout.

## 3. Primary user flow (end to end)

1. Engineer signs in (magic-link email), lands in their firm workspace.
2. Creates project "Oak Creek Phase 2", milestone "30%".
3. Imports `takeoff.xlsx` exported from Civil 3D → maps columns (description, qty, unit) → rows appear.
4. Clicks "Match prices": each row gets a suggested TxDOT item + unit price with confidence; engineer accepts all high-confidence, fixes three, types a manual price for one.
5. Sets contingency 20%, sections auto-grouped (Earthwork, Paving, Storm, Water, Sanitary, Misc) **[assumed section taxonomy — Codex please challenge]**.
6. Exports PDF exhibit with firm logo; downloads XLSX too.
7. Six weeks later: duplicates 30% → "60%", re-imports the new takeoff, matches, exports; opens Delta view 30%→60% and sees total moved +8.4% driven by storm-pipe quantity.

## 4. Data model (Postgres)

```
firms(id, name, logo_url, disclaimer_text, created_at)
users(id, email, name)                     -- auth via magic link
firm_members(firm_id, user_id)             -- PK (firm_id, user_id)
projects(id, firm_id, name, location, created_at)
estimates(id, project_id, milestone enum('30','60','90','100','custom'), label,
          contingency_pct numeric(5,2), status enum('draft','final'), created_at, cloned_from_id)
sections(id, estimate_id, name, sort)
line_items(id, estimate_id, section_id, sort, description, quantity numeric(14,3), unit text,
           price_item_id nullable, unit_price numeric(14,2), price_source enum('seed','firm','manual'),
           match_confidence numeric(4,3) nullable, source_row jsonb)
price_items(id, firm_id nullable /* null = seed */, code, description, unit,
            unit_price numeric(14,2), region text, effective_date, source_url)
imports(id, estimate_id, filename, column_map jsonb, row_count, created_at)
```
Money math: numeric, never float. Totals computed in one pure function (`lib/estimate/math.ts`) and covered by unit tests; the PDF/XLSX renderers consume its output, never recompute.

## 5. Stack

- Next.js (App Router) + TypeScript, deployed on Vercel (free tier).
- Postgres on Neon (free tier) via Drizzle ORM. **[assumed Drizzle over Prisma — lighter, SQL-shaped; Codex may object]**
- Auth: Auth.js with email magic-link provider (Resend free tier for mail). **[assumed]**
- LLM: Claude API (latest Sonnet-class model) for S5 classification, structured output, batch of ≤50 rows per call; results cached by (description, unit) hash so repeat imports don't re-spend.
- Import parsing: `xlsx` (SheetJS) + `papaparse`.
- Export: `@react-pdf/renderer` for PDF, `exceljs` for XLSX.
- Tests: Vitest (unit, incl. money math), Playwright (primary flow), run in GitHub Actions CI.

## 6. External dependencies

- TxDOT 12-month average low-bid unit price reports (public, published per district/statewide). Seed script normalizes into `price_items` with `source_url` and `effective_date`. Exact file format and URL to be confirmed in M1 — **first spike task**.
- Anthropic API key, Resend key, Neon connection string — Vercel env vars.

## 7. Acceptance criteria (Honey0 tests against these)

- AC1 A user can create a firm, invite a second email, and the second user sees the same projects.
- AC2 Importing the fixture `fixtures/takeoff-30.xlsx` (40 rows) produces 40 line items with description, qty, unit preserved exactly.
- AC3 Pasting 5 TSV rows into the grid produces 5 line items.
- AC4 "Match prices" assigns a `price_item_id` and confidence to ≥ 90 % of fixture rows; every suggestion is editable; no line item shows a price the user has not seen.
- AC5 Estimate total equals Σ(qty × unit_price) × (1 + contingency/100), rounded half-up to cents; verified for fixture (expected total documented in the fixture README).
- AC6 Manual price overrides display a "manual" flag and survive re-running "Match prices".
- AC7 Delta view between fixtures `takeoff-30.xlsx` and `takeoff-60.xlsx` lists exactly the documented added/removed/changed rows and the correct total swing.
- AC8 PDF export contains firm logo, project name, milestone, every section and line item, contingency line, total, and disclaimer text; XLSX export has the same rows and a total cell that is a live formula.
- AC9 A firm member cannot read another firm's project (direct URL returns 404).
- AC10 Seed price library loads ≥ 500 TxDOT items with `source_url` populated.
- AC11 Privacy statement page is reachable from the app footer and names the LLM provider.

## 8. Milestones

- **M1 walking skeleton**: auth + firm + project + manual line items + deterministic total + PDF export with hard-coded prices. TxDOT format spike done. (AC1, AC3, AC5, AC8-partial, AC9)
- **M2 feature-complete**: XLSX/CSV import, seed library, LLM matching, firm library, delta view, XLSX export. (all ACs)
- **M3 release candidate = demo**: fixtures polished, demo script, zero open `severity:high`. Tag `v1.0.0`.

## 9. Risks / open items for Codex to press on

- Section taxonomy: hard-coded list vs. derived from TxDOT item codes vs. user-defined.
- Whether XLSX import column mapping needs to be persisted per firm (probably yes, cheap).
- TxDOT data format unknown until the spike — could be PDF-only, which would push the seed to a one-time manual ETL.
- Delta view identity: matching line items across milestones by `price_item_id` first, then normalized description — false pairs are the main UX risk.
