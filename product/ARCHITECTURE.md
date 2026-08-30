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

## 10. Codex Stage A review

Review basis: commit `7c01927`. Verdicts below are section-by-section. An objection is
resolved only when Claude accepts the alternative or records a different decision in
`docs/DECISIONS.md`.

### §1 Problem statement — agree, with evidence caveat

The audience and workflow are sufficiently specific for a demo. The missing practitioner
quotes are accurately disclosed and do not block engineering. Do not turn the current
workflow description into a validated marketing claim until interviews supply evidence.

### §2 v1 scope — object in four places

1. **Workspace authorization:** replace the single-role assumption with `owner` and
   `member`. Only owners may edit firm settings or invite/revoke members; both roles may
   work on projects. Add expiring, single-use invitations. This is the smallest model that
   makes AC1 and AC9 testable without allowing every member to control tenancy.
2. **Sections:** use firm-editable sections with a seeded six-section default. Imported
   rows start in `Uncategorized`; matching may suggest a section but never silently move a
   row. Do not derive the taxonomy from TxDOT codes because an exhibit's organization is a
   firm presentation choice, not a pricing-source property.
3. **Import mappings:** persist a named mapping per firm and file type, while allowing an
   import-time override. Repeated Civil 3D exports are the core workflow, so remapping every
   milestone would preserve the drudgery the product claims to remove.
4. **Price provenance:** a displayed price must carry source, geography, as-of date, and
   retrieval/import date. “TxDOT” alone is not enough for a defensible exhibit.

### §3 primary user flow — object to opaque bulk acceptance

Keep the flow, but replace “accepts all high-confidence” with an explicit review queue.
Confidence is a sorting aid, not an approval rule. The user may select several reviewed
suggestions and accept them together, but the UI must show description, unit, price,
district/geography, and as-of date before acceptance. Re-import must present a reconciliation
preview before it mutates an estimate.

### §4 data model — object; stable identity and provenance are missing

Preserve the general relational model and numeric types, with these changes:

- Add `firm_members.role`, `firm_invitations`, and authorization checks scoped by `firm_id`.
- Replace estimate-owned section definitions with firm templates plus an estimate snapshot,
  so old exports do not change when a firm later edits its defaults.
- Add a project-level `cost_items` identity. Each `line_item` references `cost_item_id`.
  Cloning preserves it; import reconciliation proposes links; users resolve ambiguous rows.
  Delta comparison uses this ID only—never normalized-description fuzzy matching as truth.
- Split price provenance into immutable `price_catalogs` (source, geography, effective
  period, retrieved date, source URL) and `price_entries` (code, description, unit, value).
  A line item snapshots the accepted unit price and provenance so later catalog refreshes
  cannot rewrite a historical estimate.
- Persist import mapping templates and import row outcomes. Keep `source_row` only as
  diagnostic input; do not make behavior depend on undocumented JSON.
- Define estimate uniqueness for standard milestones per project, or explicitly allow
  revisions. Recommended: `milestone` plus integer `revision`, unique per project.

Money policy: calculate each extended line amount with decimal arithmetic and round half-up
to cents, sum rounded line amounts, then calculate and round contingency to cents. PDF,
XLSX, UI, and tests consume the same result object.

### §5 stack — agree with two substitutions

Drizzle is the better default here: the model is relational, migrations must be reviewable,
and no Prisma-only capability is required. Keep Auth.js, Next.js, Neon, Vitest, Playwright,
React PDF, and ExcelJS.

Use ExcelJS for both XLSX read/write and Papa Parse for CSV; remove SheetJS unless the import
spike proves ExcelJS cannot read a required Civil 3D export. Pin the Anthropic model ID in
configuration rather than using a moving “latest Sonnet-class” target. Put the model behind
a matcher interface with a deterministic fake for acceptance tests.

### §6 external dependencies — object to postponing source feasibility

The TxDOT format spike is a Stage A exit dependency, not an ordinary M1 implementation
detail: catalog schema, geography selection, AC10, and the product's “regionally priced”
claim all depend on it. The spike must record the authoritative URL, format, update cadence,
geographic grain, fields, reuse terms, and one checked-in normalized fixture. If automated
retrieval is impractical, v1 may use a reviewed, versioned snapshot importer; silent manual
copying is not acceptable provenance.

### §7 acceptance criteria — object to AC4 and tighten AC5/AC7/AC10

- AC1–AC3, AC6, AC8, AC9, and AC11: agree after applying the role/provenance changes above.
- AC4: split product behavior from model quality. Product AC: a deterministic matcher fixture
  returns suggestions, every suggestion requires explicit confirmation, and overrides
  survive reruns. Evaluation AC: on a versioned labeled dataset, a pinned live model reports
  top-1 precision/coverage and cost; the threshold is recorded after the TxDOT spike. A live
  model cannot be a deterministic CI gate.
- AC5: use the rounding order defined in §4 and add zero, negative, high-precision, and
  overflow/boundary cases. Negative quantities may be valid credits; reject them only if
  product intent says so.
- AC7: expected deltas must be based on stable `cost_item_id`; ambiguous imported rows remain
  unresolved and excluded from a final delta until a user links them.
- AC10: replace the arbitrary ≥500 count with completeness against the chosen source snapshot
  (expected row count and checksum in fixture metadata). A large partial import is still bad.

### §8 milestones — object to sign-off sequencing, agree with the slices

Keep the three milestones, but the TxDOT source spike and this review's architecture
resolutions must finish before M1 build issues begin. M1 should prove tenant isolation and
the shared calculation/export boundary. M2 owns catalog ingestion, imports, matching, and
deltas. M3 is a reproducible demo build, not a production-readiness claim; `v1.0.0` should be
tagged only after Honey0's full test run and joseleos's acceptance.

### §9 risks — agree; proposed resolutions

- Taxonomy: firm-editable, seeded defaults, snapshotted per estimate.
- Mapping persistence: named, firm-scoped templates.
- TxDOT format: Stage A spike with fixture and provenance record.
- Delta identity: project-level stable cost-item IDs plus user reconciliation; no fuzzy
  match silently establishes identity.
- Drizzle versus Prisma: Drizzle.

**Review status: objections outstanding.** Claude must resolve the objections and both agents
must sign off in the channel before Stage B begins.
