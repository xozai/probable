# Probable — v1 Architecture

Status: **v2 — Codex objections resolved** (Claude, 2026-08-30; review basis `2b99225`).
Every §10 objection is accepted unless a resolution note below says otherwise. Product-intent answers from joseleos are
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
- S1 Firm workspace. Roles `owner` / `member`: owners edit firm settings and invite/revoke; both work on projects. Invitations are expiring (7 days), single-use, email-bound. First user of a firm is owner.
- S2 Projects, each with **estimates** keyed by `(milestone, revision)` — milestone ∈ {30, 60, 90, 100, custom}, revision integer, unique per project. Cloning an estimate creates the next revision or a new milestone.
- S3 Line-item entry: manual grid, paste-from-clipboard (TSV), and CSV/XLSX import with a column-mapping step. Named mapping templates persist per firm + file type; import-time override allowed.
- S4 Price catalogs. (a) Seed catalog: **TxDOT Bid Tabulations (data.texas.gov `de7b-7dna`)**, quantity-weighted average of low-bid unit prices per bid code per district over a trailing 12-month window (see `research/txdot/TXDOT_SOURCE_SPIKE.md`). (b) Firm-private price entries, which take precedence. Every displayed price carries provenance: source, geography, window/as-of, retrieved date, source URL.
- S5 Matching assist: a `Matcher` interface maps imported free-text rows to catalog entries with a confidence score. Production implementation = pinned Anthropic model via structured output; tests use a deterministic fake. Suggestions land in an explicit **review queue**; nothing is priced until a user accepts it with provenance visible. Overrides survive re-runs.
- S6 Estimate math (see §4 money policy). Deterministic, server-side, one pure module.
- S7 **Delta view** between any two estimates of a project, keyed on stable `cost_item_id`. Import reconciliation proposes links; ambiguous rows stay unresolved and are excluded from a final delta until a user links them.
- S8 Exhibit export: PDF and XLSX. Firm logo, project header, sections, line items, contingency, total, disclaimer, and a source-attribution footer for seed prices.
- S9 Privacy statement page (names Anthropic, what is sent, purpose).

Explicit non-goals for v1:
- PDF plan-sheet parsing / CAD ingestion.
- Payments, plans, trials. Public sign-up beyond magic link.
- CSI MasterFormat / AACE class labelling.
- Licensed price sources (RSMeans etc.). County-grain pricing (district only in v1).
- Mobile layout.

## 3. Primary user flow (end to end)

1. Engineer signs in (magic link), lands in their firm workspace (owner created it, invited a colleague).
2. Creates project "Oak Creek Phase 2", estimate 30% rev 1. Sections are copied from the firm's defaults (seeded six: Earthwork, Paving, Storm, Water, Sanitary, Misc; firm-editable). Imported rows start in *Uncategorized*.
3. Imports `takeoff-30.xlsx` → picks the saved "Civil 3D takeoff" mapping → **preview** shows parsed rows with validation → commits.
4. Runs "Suggest prices" → review queue lists each row with suggested TxDOT item, unit, district, window, weighted avg, n. Engineer accepts reviewed rows (multi-select allowed), fixes three, enters a manual price for one, drags rows into sections.
5. Sets contingency 20 %; totals update from the shared calculation result.
6. Exports PDF (and XLSX). Footer: "Seed unit prices: TxDOT Bid Tabulations via data.texas.gov, Houston district, lettings 2025-09-01–2026-08-31, retrieved 2026-08-30."
7. Six weeks later: clones 30% → 60% (cost-item IDs preserved), imports `takeoff-60.xlsx` → **reconciliation preview** auto-links exact matches, asks about two ambiguous rows → commits → Delta view 30%→60% shows +8.4 % driven by storm-pipe quantity; unresolved rows are listed separately.

## 4. Data model (Postgres, Drizzle)

```
firms(id, name, logo_url, disclaimer_text, created_at)
users(id, email, name)
firm_members(firm_id, user_id, role enum('owner','member'))            PK(firm_id,user_id)
firm_invitations(id, firm_id, email, token_hash, expires_at, accepted_at, revoked_at, created_by)
firm_section_templates(id, firm_id, name, sort)
import_mappings(id, firm_id, name, file_type enum('csv','xlsx'), column_map jsonb)
projects(id, firm_id, name, location, district text, created_at)
cost_items(id, project_id, key text, created_at)                        -- stable identity across estimates
estimates(id, project_id, milestone enum('30','60','90','100','custom'), revision int, label,
          contingency_pct numeric(5,2), status enum('draft','final'), cloned_from_id, created_at)
          UNIQUE(project_id, milestone, revision)
estimate_sections(id, estimate_id, name, sort)                         -- snapshot of firm templates
line_items(id, estimate_id, section_id nullable, cost_item_id, sort, description,
           quantity numeric(14,3), unit text,
           unit_price numeric(14,2), price_source enum('seed','firm','manual'),
           price_entry_id nullable, price_provenance jsonb,            -- snapshot: source, geography, window, retrieved_at, url, n
           match_confidence numeric(4,3) nullable, match_status enum('unpriced','suggested','accepted','manual'))
price_catalogs(id, firm_id nullable /* null = seed */, source text, geography text, window_from date, window_to date,
               retrieved_at timestamptz, source_url text, row_count int, sha256 text, created_at)  -- immutable
price_entries(id, catalog_id, code, description, unit, unit_price numeric(14,2),
              simple_avg numeric(14,2) nullable, n_observations int nullable, total_qty numeric(18,3) nullable, is_lump_sum bool)
imports(id, estimate_id, filename, mapping_id nullable, column_map jsonb, status, row_count, created_at)
import_rows(id, import_id, row_no, raw jsonb, outcome enum('created','linked','skipped','error'), line_item_id nullable, message)
```
Authorization: every query is scoped by `firm_id` derived from the session; cross-firm access returns 404.

Money policy: line extension = round_half_up(quantity × unit_price, 2); subtotal = Σ line extensions; contingency = round_half_up(subtotal × pct/100, 2); total = subtotal + contingency. Decimal arithmetic only (`decimal.js`), in `lib/estimate/math.ts`; PDF, XLSX, UI, and tests consume the same result object. Negative quantities are **rejected** in v1 (Claude decision; credits can be added later with a note in DECISIONS).

## 5. Stack

- Next.js (App Router) + TypeScript on Vercel. Postgres on Neon via Drizzle (reviewable SQL migrations).
- Auth.js email magic link (Resend); test adapter in CI, no mail sent.
- Import: ExcelJS (xlsx read/write) + Papa Parse (csv). No SheetJS unless the fixture proves ExcelJS insufficient.
- Export: `@react-pdf/renderer` (PDF), ExcelJS (XLSX with live formulas).
- Matching: `Matcher` interface; `AnthropicMatcher` with model ID pinned in config, structured output, batches ≤50 rows, cache key = hash(prompt version, schema version, model, catalog id, description, unit); `FakeMatcher` for tests.
- Tests: Vitest (unit), Playwright (e2e), GitHub Actions. Model-quality evaluation harness is separate from CI (§7).

## 6. External dependencies

- **TxDOT Bid Tabulations** via Socrata SODA (`https://data.texas.gov/resource/de7b-7dna.json`). Ingestion is a versioned importer run against a fixed window; each run produces an immutable `price_catalog` with row count + checksum. Fixture and provenance record: `research/txdot/`. Reuse terms recorded there; attribution printed on exhibits.
- Anthropic API, Resend, Neon — Vercel env vars. Demo seed runs with no live email or LLM calls.

## 7. Acceptance criteria (Honey0 derives `product/tests/TEST_PLAN.md` from these)

- AC1 Owner creates a firm, invites an email; invitee accepts once before expiry and sees the same projects; a second use of the link, an expired link, or a revoked link fails. Members cannot change firm settings or invite.
- AC2 Importing fixture `takeoff-30.xlsx` (40 rows) through the mapping preview creates exactly 40 line items with description, qty, unit preserved; the preview does not mutate until commit; commit is atomic.
- AC3 Pasting 5 TSV rows into the grid creates 5 line items with validation feedback on bad rows. Paste is atomic: rows are staged, invalid rows are flagged inline, and nothing persists until every staged row is valid (see `docs/DECISIONS.md`).
- AC4a (product) With `FakeMatcher`, every fixture row receives a suggestion carrying code, unit, price, district, window, n; no line item is priced until accepted; multi-select accept works; manual and accepted prices survive a re-run.
- AC4b (evaluation, not CI) `AnthropicMatcher` on the versioned labelled set `product/eval/matcher-v1.jsonl` reports top-1 precision, coverage, latency, cost; threshold set after the first run and recorded in DECISIONS.
- AC5 Totals follow the §4 money policy; unit tests cover zero qty, high-precision qty (0.001), large values (≥ 1e9), rounding boundaries (x.xx5), and rejection of negative quantities; fixture expected total documented in `fixtures/README.md`.
- AC6 Manual prices show a "manual" badge and are unchanged by "Suggest prices".
- AC7 Delta between fixtures 30% and 60% lists exactly the documented added / removed / qty-changed / price-changed rows keyed by `cost_item_id`, with the documented total swing; unresolved rows are listed separately and excluded from the swing.
- AC8 PDF contains logo, project name, milestone + revision, every section and line item, contingency, total, disclaimer, and seed-price attribution footer; XLSX mirrors the rows and its total cell is a live formula whose cached value equals the shared result.
- AC9 A member of firm A requesting any firm-B resource by direct ID gets 404 for reads and mutations.
- AC10 Seed importer loads the Houston fixture to exactly 2,005 entries with sha256 `7f69ddc0…51a7`; a truncated or altered file fails closed with no partial catalog.
- AC11 Privacy page reachable from the authenticated footer; names Anthropic and what is sent.
- AC12 Editing a firm's section templates does not change sections of existing estimates.

## 8. Milestones

- **Stage A exit (now):** A1 spike ✔, A2 resolution ✔ (this doc), A3 Honey0 test plan — then Stage B.
- **M1 walking skeleton:** app + CI, tenant schema, roles + invitations, projects/estimates, section templates + snapshot, manual/TSV grid, money module, PDF export with hard-coded prices, tenant-isolation tests, e2e. (AC1, AC3, AC5, AC8-PDF, AC9, AC12)
- **M2 feature-complete:** catalog schema + TxDOT importer, price search, firm prices, CSV/XLSX import + mappings + transactional commit, matcher interface/fake/Anthropic, review queue, eval harness, clone with cost-item IDs, reconciliation, delta, XLSX export, privacy page, e2e. (all ACs)
- **M3 reproducible demo:** fixtures, one-command deterministic seed/reset (no live email/LLM), demo script, accessibility/failure-state pass, Honey0 full run at a named commit, joseleos acceptance → tag `v1.0.0`.

## 9. Resolved risks

| Risk | Resolution |
|---|---|
| Section taxonomy | Firm-editable templates, seeded six, snapshotted per estimate; imports land in Uncategorized |
| Mapping persistence | Named, firm + file-type scoped templates with import-time override |
| TxDOT data format | Resolved by A1: Socrata Bid Tabulations, computed weighted low-bid averages, immutable catalogs with checksum |
| Delta identity | Project-level `cost_items`; reconciliation proposes, user establishes; fuzzy never silently links |
| ORM | Drizzle |
| Price defensibility | Provenance snapshot on every priced line; attribution footer; LS items flagged non-comparable |

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

**Resolution (Claude, 2026-08-30):** all objections accepted and folded into §2–§9 above; one
added decision — negative quantities rejected in v1. Awaiting Codex counter-sign in channel.
