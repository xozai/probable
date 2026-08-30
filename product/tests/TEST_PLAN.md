# Probable — v1 Test Plan

Derived from `product/ARCHITECTURE.md` v2 §7 (AC1–AC12), basis commit `221b525`.
Owner: Honey0. Executed once per milestone tag (M1, M2, M3) against a named commit;
results posted with total/pass/fail and open bugs by severity per the `product-build`
skill. Failures are filed as GitHub issues labelled `bug`, `severity:high|medium|low`,
with test ID, repro steps, expected vs. actual, environment.

AC4 is split per Codex's Stage A objection: **AC4a is a deterministic product gate**
(pass/fail, CI-eligible with `FakeMatcher`); **AC4b is a model-quality evaluation**
(a report, not a pass/fail gate — it does not block a milestone).

## How to run

- Unit (money module, validation): Vitest.
- Integration (import, matching, delta, tenant scoping): Vitest against a test DB.
- End-to-end (auth → estimate → export): Playwright, deterministic seed, no live
  email or LLM calls (per §6 "Demo seed runs with no live email or LLM calls").
- Fixtures referenced below live under `product/tests/fixtures/` unless noted;
  they are produced by M1-13 (walking-skeleton fixture), M2-19/M2 import fixtures,
  and M3-01 (demo fixture polish) — this plan specifies what each fixture must
  contain so those issues build to spec, not the other way around.
- `fixtures/README.md` (AC5, AC10) records expected totals, row counts, and checksums
  next to the fixture files they describe.

## Traceability

| AC | Feature | Milestone | Test IDs |
|---|---|---|---|
| AC1 | Firm roles + invitations | M1 | T-AC1-01…07 |
| AC2 | CSV/XLSX import via mapping preview | M2 | T-AC2-01…03 |
| AC3 | Manual + TSV paste grid | M1 | T-AC3-01…02 |
| AC4a | Matching — product behavior (FakeMatcher) | M2 | T-AC4a-01…04 |
| AC4b | Matching — model evaluation (AnthropicMatcher) | M2 | T-AC4b-01 |
| AC5 | Estimate math / money policy | M1 | T-AC5-01…06 |
| AC6 | Manual price badge | M2 | T-AC6-01…02 |
| AC7 | Delta view | M2 | T-AC7-01…03 |
| AC8 | PDF/XLSX exhibit export | M1 (PDF), M2 (XLSX) | T-AC8-01…04 |
| AC9 | Tenant isolation | M1 | T-AC9-01…02 |
| AC10 | Seed catalog importer | M2 | T-AC10-01…03 |
| AC11 | Privacy page | M2 | T-AC11-01…02 |
| AC12 | Section template edits are non-retroactive | M1 | T-AC12-01…02 |

---

## AC1 — Firm workspace roles and invitations

**T-AC1-01 — First user of a firm is owner**
- Preconditions: no existing firm.
- Steps: sign in (magic link) as a new user; create a firm.
- Expected: the creating user has role `owner`.

**T-AC1-02 — Invitee accepts once before expiry and sees the firm's projects**
- Preconditions: owner exists in firm F with at least one project.
- Steps: owner invites `newuser@example.com`; invitee opens the invitation link within 7 days and accepts.
- Expected: invitee becomes a `member` of F; on sign-in, invitee's project list matches the owner's.

**T-AC1-03 — Invitation is single-use**
- Preconditions: an invitation already accepted per T-AC1-02.
- Steps: open the same invitation link again.
- Expected: acceptance fails (already used); no duplicate membership row is created.

**T-AC1-04 — Expired invitation fails**
- Preconditions: an invitation created >7 days ago, not accepted.
- Steps: open the invitation link.
- Expected: acceptance fails with an expired-link message; no membership is created.

**T-AC1-05 — Revoked invitation fails**
- Preconditions: owner sends an invitation, then revokes it before acceptance.
- Steps: invitee opens the revoked link.
- Expected: acceptance fails; no membership is created.

**T-AC1-06 — Member cannot change firm settings**
- Preconditions: user is a `member` of firm F.
- Steps: member attempts to edit F's name/logo/disclaimer via API or UI.
- Expected: request is rejected (403/forbidden); firm settings unchanged.

**T-AC1-07 — Member cannot invite or revoke**
- Preconditions: user is a `member` of firm F.
- Steps: member attempts to send an invitation and to revoke an existing one.
- Expected: both actions are rejected; no invitation row is created or altered.

---

## AC2 — CSV/XLSX import via mapping preview

**T-AC2-01 — Import creates exactly the fixture's row count with fields preserved**
- Preconditions: fixture `takeoff-30.xlsx` (40 rows) exists under `product/tests/fixtures/`; a saved "Civil 3D takeoff" mapping exists for the firm.
- Steps: import `takeoff-30.xlsx`; apply the saved mapping; commit.
- Expected: exactly 40 line items are created; each item's description, quantity, and unit match the source row exactly (per fixture's documented expected values in `fixtures/README.md`).

**T-AC2-02 — Preview does not mutate until commit**
- Preconditions: same fixture and mapping as T-AC2-01.
- Steps: run the import through the preview step; do not commit; query the estimate's line items.
- Expected: no line items exist yet; the estimate is unchanged from before the import started.

**T-AC2-03 — Commit is atomic**
- Preconditions: same fixture; a way to force a mid-commit failure (e.g. a fault-injection flag or a row engineered to violate a DB constraint after preview passes).
- Steps: trigger commit; force failure partway through row insertion.
- Expected: zero line items from this import persist (all-or-nothing); the estimate is left in its pre-commit state; the import is marked failed, not partially committed.

---

## AC3 — Manual and TSV-paste line-item grid

**T-AC3-01 — Pasting valid TSV rows creates matching line items**
- Preconditions: an empty estimate is open in the grid.
- Steps: paste 5 well-formed TSV rows (description, quantity, unit).
- Expected: exactly 5 line items are created with values matching the pasted rows.

**T-AC3-02 — Bad rows in a paste block the save and show validation feedback**
- Preconditions: an empty estimate is open in the grid.
- Steps: paste 5 TSV rows where 2 rows have invalid data (e.g. non-numeric quantity, missing unit); attempt to save.
- Expected: the 2 invalid rows are flagged inline with a specific validation message per row; the grid does not silently drop or guess values for them; **no line items persist** (paste is atomic per `docs/DECISIONS.md`). After the user corrects or removes the 2 rows and saves, exactly the remaining valid rows are created.

---

## AC4a — Matching assist, product behavior (FakeMatcher, CI gate)

**T-AC4a-01 — Every fixture row receives a suggestion with full provenance**
- Preconditions: an estimate with imported/pasted rows from the M2 import fixture; `Matcher` configured as `FakeMatcher`.
- Steps: run "Suggest prices".
- Expected: every row has a suggestion carrying code, unit, price, district, window, and `n`; suggestions appear in the review queue, not applied automatically.

**T-AC4a-02 — Nothing is priced until accepted**
- Preconditions: same as T-AC4a-01, suggestions generated but not yet acted on.
- Steps: inspect line items before accepting any suggestion.
- Expected: no line item has a non-null `unit_price` from this run; `match_status` is `suggested`, not `accepted`.

**T-AC4a-03 — Multi-select accept applies to all selected rows**
- Preconditions: review queue populated per T-AC4a-01.
- Steps: select 3 suggested rows; accept them together.
- Expected: all 3 line items now have `match_status = accepted`, the suggested price, and full provenance snapshot; unselected rows remain `suggested`.

**T-AC4a-04 — Accepted and manual prices survive a re-run**
- Preconditions: one line item accepted per T-AC4a-03, one line item given a manual price.
- Steps: run "Suggest prices" again.
- Expected: the accepted line item's price/provenance is unchanged; the manual line item is untouched (see AC6); only unpriced/unaccepted rows receive new suggestions.

---

## AC4b — Matching assist, model evaluation (not a CI gate)

**T-AC4b-01 — AnthropicMatcher evaluation report**
- Preconditions: versioned labelled set `product/eval/matcher-v1.jsonl` exists; `AnthropicMatcher` configured with the pinned model ID from `§5`.
- Steps: run the evaluation harness (outside CI) against the labelled set.
- Expected: a report is produced with top-1 precision, coverage, latency, and cost. This is **not** pass/fail — record results in `docs/DECISIONS.md` and set the acceptance threshold there after the first run, per ARCHITECTURE.md §7.

---

## AC5 — Estimate math / money policy

All cases exercise `lib/estimate/math.ts` directly (unit) and via a full estimate (integration), per the shared-result-object rule in §4/§5.

**T-AC5-01 — Zero quantity**
- Steps: line item with quantity = 0, unit_price = 100.00.
- Expected: line extension = 0.00; contributes 0 to subtotal.

**T-AC5-02 — High-precision quantity**
- Steps: line item with quantity = 0.001, unit_price = 100.00.
- Expected: line extension = round_half_up(0.001 × 100.00, 2) = 0.10.

**T-AC5-03 — Large value**
- Steps: line item with quantity = 1,000,000, unit_price = 1,500.00 (extension ≥ 1e9).
- Expected: extension computed exactly via decimal arithmetic, no floating-point drift (e.g. 1,500,000,000.00 exactly).

**T-AC5-04 — Rounding boundary (x.xx5)**
- Steps: construct a quantity/price pair whose raw product is exactly `N.NN5` (e.g. 1.25 × 0.02 = 0.025).
- Expected: rounds half-up to the next cent (0.025 → 0.03), consistently for both line extension and contingency rounding.

**T-AC5-05 — Negative quantity is rejected**
- Steps: attempt to create/save a line item with quantity = -1.
- Expected: rejected with a validation error; no line item is created (per `docs/DECISIONS.md`: "Negative quantities rejected in v1").

**T-AC5-06 — Fixture total matches documented expected value**
- Preconditions: `fixtures/README.md` documents the expected subtotal/contingency/total for the M1 walking-skeleton fixture.
- Steps: compute the total for that fixture estimate at its documented contingency %.
- Expected: subtotal, contingency, and total exactly match the documented values.

---

## AC6 — Manual price badge

**T-AC6-01 — Manual price shows a "manual" badge**
- Preconditions: a line item with `price_source = manual`.
- Steps: view the line-item grid.
- Expected: the row displays a "manual" badge distinct from `seed`/`firm`-sourced rows.

**T-AC6-02 — "Suggest prices" does not alter a manual row**
- Preconditions: same as T-AC6-01.
- Steps: run "Suggest prices" on the estimate.
- Expected: the manual line item's price, `price_source`, and badge are unchanged.

---

## AC7 — Delta view

**T-AC7-01 — Delta lists exactly the documented row changes**
- Preconditions: fixtures for the 30% and 60% estimates exist with a documented set of added/removed/qty-changed/price-changed rows in `fixtures/README.md`, linked by `cost_item_id`.
- Steps: open the delta view between the 30% and 60% estimates.
- Expected: the added, removed, qty-changed, and price-changed rows exactly match the documented set — no extra rows, none missing.

**T-AC7-02 — Total swing matches documented value**
- Preconditions: same fixtures as T-AC7-01.
- Steps: read the delta view's total swing (e.g. "+8.4%").
- Expected: swing matches the documented value exactly.

**T-AC7-03 — Unresolved rows are separated and excluded from the swing**
- Preconditions: fixture includes at least one ambiguous row that reconciliation leaves unlinked.
- Steps: open the delta view.
- Expected: the unresolved row appears in a separate "unresolved" list, not in added/removed/changed, and is excluded from the total swing calculation.

---

## AC8 — Exhibit export (PDF/XLSX)

**T-AC8-01 — PDF contains required content**
- Preconditions: a firm with a logo, a project, and a priced estimate (hard-coded/fixture prices acceptable per M1 scope).
- Steps: export the estimate as PDF.
- Expected: PDF contains the firm logo, project name, milestone + revision, every section and line item, contingency, total, and the non-binding disclaimer.

**T-AC8-02 — PDF seed-price attribution footer**
- Preconditions: estimate includes at least one seed-priced (TxDOT) line item.
- Steps: export as PDF.
- Expected: footer includes source attribution text (source, geography/district, window, retrieved date) matching the pattern in §3 ("Seed unit prices: TxDOT Bid Tabulations via data.texas.gov, <district> district, lettings <window>, retrieved <date>").

**T-AC8-03 — XLSX mirrors PDF rows**
- Preconditions: same estimate as T-AC8-01.
- Steps: export as XLSX; compare rows to the PDF.
- Expected: every section/line item/contingency/total row in the PDF has a matching row in the XLSX.

**T-AC8-04 — XLSX total is a live formula matching the shared result**
- Preconditions: same estimate.
- Steps: open the XLSX total cell; inspect its formula and cached value; compute the total independently via `lib/estimate/math.ts`.
- Expected: the cell contains a live formula (not a hard-coded number); its cached value equals the shared calculation result object's total.

---

## AC9 — Tenant isolation

**T-AC9-01 — Cross-firm read returns 404**
- Preconditions: firm A and firm B each have at least one project; user is a member of A only.
- Steps: as the firm-A user, request firm-B's project by direct ID (API and/or URL).
- Expected: 404, not 403 (existence is not disclosed); no data from firm B is returned.

**T-AC9-02 — Cross-firm mutation returns 404**
- Preconditions: same as T-AC9-01.
- Steps: as the firm-A user, attempt to edit or delete a firm-B resource by direct ID.
- Expected: 404; firm-B resource is unchanged.

---

## AC10 — Seed catalog importer

**T-AC10-01 — Houston fixture imports to the exact documented count/checksum**
- Preconditions: fixture `research/txdot/houston_low_bid_avg_2025-09_2026-08.csv` (sha256 `7f69ddc0c7ec31db18dc0a1260c005e9414c6194d1b9a169dc5cf35dd7b251a7` per Codex's PR #2 counter-sign).
- Steps: run the seed importer against the fixture.
- Expected: catalog contains exactly 2,005 entries; catalog's recorded checksum matches the fixture's sha256.

**T-AC10-02 — Truncated file fails closed**
- Steps: run the importer against a copy of the fixture truncated to fewer rows.
- Expected: import fails; no catalog (partial or otherwise) is created.

**T-AC10-03 — Altered file fails closed**
- Steps: run the importer against a copy of the fixture with an altered value (checksum mismatch).
- Expected: import fails on checksum mismatch; no catalog is created.

---

## AC11 — Privacy page

**T-AC11-01 — Privacy page reachable from authenticated footer**
- Preconditions: signed-in user on any authenticated page.
- Steps: click the footer's privacy link.
- Expected: navigates to the privacy page without error.

**T-AC11-02 — Page discloses Anthropic usage**
- Steps: read the privacy page content.
- Expected: names Anthropic and describes what data is sent (line-item classification) and for what purpose.

---

## AC12 — Section template edits are non-retroactive

**T-AC12-01 — Editing templates does not change existing estimates**
- Preconditions: firm F has an estimate E1 created from the current section templates.
- Steps: owner edits F's section templates (rename/add/remove a section).
- Expected: E1's sections are unchanged (its snapshot from creation time persists).

**T-AC12-02 — New estimates reflect the updated templates**
- Preconditions: same as T-AC12-01, templates already edited.
- Steps: create a new estimate E2.
- Expected: E2's sections match the current (edited) templates, not E1's.
