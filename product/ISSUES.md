# Probable — v1 issue breakdown

Status: **DRAFT pending Stage A resolution**. Every implementation issue is scoped to one
focused agent-day or less. Dependencies refer to IDs in this document. Builders must still
use one branch/worktree and PR per issue.

## Stage A gates

| ID | Milestone | Issue | Depends on | Done when |
|---|---|---|---|---|
| A1 | M1 | Verify TxDOT catalog source and create normalization fixture | — | Architecture records authoritative URL, format, cadence, geography, reuse terms, fields, expected row count/checksum, and a small normalized fixture. |
| A2 | M1 | Resolve Stage A objections and update architecture/decisions | A1 | Claude resolves every §10 objection; data model and acceptance criteria are internally consistent; Claude and Codex sign off in channel. |
| A3 | M1 | Derive QA test plan from accepted criteria | A2 | Honey0 adds test IDs, preconditions, steps, and expected outcomes in `product/tests/TEST_PLAN.md`. |

## M1 — walking skeleton

| ID | Milestone | Issue | Depends on | Done when |
|---|---|---|---|---|
| M1-01 | M1 | Scaffold Next.js app, checks, and CI | A2 | App builds; lint, typecheck, unit, and Playwright commands run in CI with a documented local entrypoint. |
| M1-02 | M1 | Configure Drizzle and initial tenant schema | M1-01 | Migration creates users, firms, memberships with roles, invitations, projects, estimates/revisions, section snapshots, cost items, and line items. |
| M1-03 | M1 | Implement decimal estimate calculation module | M1-01 | Pure function follows the accepted rounding policy and passes boundary/credit/precision unit tests. |
| M1-04 | M1 | Add Auth.js magic-link sign-in | M1-01 | Approved email can sign in/out; auth errors are handled; automated tests use a test adapter without sending email. |
| M1-05 | M1 | Implement firm creation and owner/member authorization | M1-02, M1-04 | First user becomes owner; server-side guards enforce firm membership and owner-only settings actions. |
| M1-06 | M1 | Implement expiring single-use member invitations | M1-05 | Owner can create/revoke invite; invited user can accept once before expiry; cross-firm and replay tests pass. |
| M1-07 | M1 | Implement project and milestone/revision CRUD | M1-05 | Member can create/list/edit projects and estimates inside their firm; duplicate milestone behavior matches architecture. |
| M1-08 | M1 | Implement editable firm section defaults and estimate snapshots | M1-05, M1-07 | New estimate copies defaults; editing firm defaults does not mutate prior estimates. |
| M1-09 | M1 | Build manual and TSV-paste line-item grid | M1-07, M1-08 | User can add/edit/order/delete rows and paste fixture rows with validation feedback. |
| M1-10 | M1 | Integrate totals into estimate UI | M1-03, M1-09 | UI shows line extensions, subtotals, contingency, and total from the shared calculation result. |
| M1-11 | M1 | Build PDF exhibit export | M1-03, M1-08, M1-10 | PDF includes specified branding/header/rows/subtotals/contingency/total/disclaimer and uses shared totals. |
| M1-12 | M1 | Add tenant-isolation integration tests | M1-05, M1-07 | Cross-firm list/direct-ID reads and mutations fail without revealing resource existence. |
| M1-13 | M1 | Add M1 fixture and end-to-end walking-skeleton test | M1-06, M1-11, M1-12 | Playwright covers sign-in, firm/member, project, manual/pasted estimate, total, and PDF request using deterministic fixtures. |

## M2 — feature complete

| ID | Milestone | Issue | Depends on | Done when |
|---|---|---|---|---|
| M2-01 | M2 | Add catalog/provenance schema and snapshot linkage | A1, M1-02 | Migration creates catalogs/entries and immutable accepted-price provenance on line items. |
| M2-02 | M2 | Implement TxDOT normalization importer | M2-01 | Versioned source fixture imports completely; row count/checksum/provenance validation fails closed. |
| M2-03 | M2 | Build price-library search and geography/as-of display | M2-02, M1-09 | User searches seed entries and sees code, unit, geography, date, and source before selection. |
| M2-04 | M2 | Implement firm-private price entries and precedence | M2-01, M1-05 | Firm can CRUD private prices; tenant isolation holds; accepted firm price snapshots provenance. |
| M2-05 | M2 | Parse CSV and XLSX into an import preview | M1-09 | Both fixture formats parse without mutation and preserve original description, quantity, and unit. |
| M2-06 | M2 | Build column-mapping UI and validation | M2-05 | User maps required columns; invalid/missing values are surfaced per row before commit. |
| M2-07 | M2 | Persist named firm import mappings | M2-06 | User saves/reuses/overrides a mapping; mappings are file-type and tenant scoped. |
| M2-08 | M2 | Commit validated import preview transactionally | M2-06 | Commit creates exactly the approved rows or rolls back; import audit records outcomes/source rows. |
| M2-09 | M2 | Define matcher interface, deterministic fake, and cache key | M2-03 | Interface accepts normalized row/catalog candidates; fake drives tests; cache includes prompt/schema/model/catalog version. |
| M2-10 | M2 | Implement pinned Anthropic structured matcher | M2-09 | Batches ≤50, validates structured output, handles partial/rate-limit failures, and records model/config without exposing secrets. |
| M2-11 | M2 | Build explicit match-review queue | M2-09, M2-10 | Suggestions show required provenance; selected reviewed rows can be accepted; rerun preserves manual/accepted overrides. |
| M2-12 | M2 | Create labeled matcher evaluation harness | A1, M2-10 | Versioned dataset reports top-1 precision, coverage, latency, and cost separately from deterministic CI. |
| M2-13 | M2 | Implement estimate clone with stable cost-item IDs | M1-07, M1-09 | Clone creates a new revision/milestone and retains stable identity while snapshotting rows/prices. |
| M2-14 | M2 | Build import reconciliation preview | M2-08, M2-13 | Exact stable links are automatic; proposed/ambiguous/new links require user resolution before commit. |
| M2-15 | M2 | Implement deterministic delta calculation | M1-03, M2-13 | Pure function classifies added/removed/quantity/price changes by stable ID and computes documented swings. |
| M2-16 | M2 | Build milestone delta UI | M2-14, M2-15 | User compares any two estimates; unresolved identities are visible and cannot masquerade as final deltas. |
| M2-17 | M2 | Build XLSX exhibit export | M1-03, M1-10 | Workbook mirrors exhibit rows and contains live formulas whose cached/documented result matches shared totals. |
| M2-18 | M2 | Add privacy statement and footer link | M1-01 | Page identifies Anthropic, data sent, purpose, retention claim if verified, and links from authenticated UI. |
| M2-19 | M2 | Add M2 end-to-end primary-flow test | M2-04, M2-07, M2-11, M2-16, M2-17, M2-18 | Fixtures cover import, mapping reuse, reviewed matching, override, clone/reconcile, delta, PDF, and XLSX. |

## M3 — reproducible demo release

| ID | Milestone | Issue | Depends on | Done when |
|---|---|---|---|---|
| M3-01 | M3 | Polish and document demo fixtures | M2-19 | 30%/60% files, catalog snapshot, logos, expected totals/deltas, and provenance metadata are reviewable and resettable. |
| M3-02 | M3 | Create deterministic demo seed/reset command | M3-01 | One documented command produces the same demo workspace without live email or LLM calls. |
| M3-03 | M3 | Write and rehearse primary demo script | M3-02 | Script covers the accepted primary flow with expected visible outcomes and recovery notes. |
| M3-04 | M3 | Run accessibility and failure-state pass | M2-19 | Keyboard path, labels, focus, empty/loading/error states, oversized import, and upstream failures have test evidence/issues. |
| M3-05 | M3 | Execute full QA plan at release commit | A3, M3-02, M3-04 | Honey0 posts commit SHA, total/pass/fail, and open bugs by severity; zero high-severity bugs remain. |
| M3-06 | M3 | Prepare accepted demo release | M3-03, M3-05 | joseleos accepts remaining medium issues; release summary references exact green commit; only then tag `v1.0.0`. |

## Suggested build split after Stage A sign-off

Assign build-ready issues alternately between Codex and Fizz0 while respecting dependencies
and avoiding shared files. Claude/Codex must review work they did not author, and the reviewer
runs the full repository suite at the PR head before approval. Do not assign Stage B work
until A1–A3 are complete.
