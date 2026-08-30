# Decisions log — Probable

| Date | Decision | By | Notes |
|---|---|---|---|
| 2026-08-30 | **pick: OPCC / cost-estimate exhibit automation** (Researcher's #1). TCP generation is the fallback. | joseleos | Discovery in `research/OPPORTUNITY_SCAN_2026-08-30.md` |
| 2026-08-30 | Probable is the Jerry Project product; its own repo `xozai/probable`; skills copied from `xozai/xozai-venture`; coordination in the Jerry Project channel | joseleos | Option (a) of Claude's governance question |
| 2026-08-30 | Working name **Probable** (from "Opinion of *Probable* Cost") | Claude, pending joseleos | Alternates considered: ProbableCost, CostExhibit |
| 2026-08-30 | v1 quantity input: manual/pasted line items + CSV/XLSX import. PDF plan-sheet parsing is a non-goal | joseleos | |
| 2026-08-30 | Launch geography: **Texas**. Unit prices seeded from public TxDOT average low-bid unit price data + per-firm price library | joseleos | Licensed sources (RSMeans) out of scope for v1 |
| 2026-08-30 | Exhibit format: clean itemized PDF + XLSX with firm logo, contingency %, non-binding disclaimer. No CSI/AACE classification in v1 | joseleos | |
| 2026-08-30 | 30/60/90% milestone delta view **in v1** | joseleos | |
| 2026-08-30 | Firm/team accounts in v1. **No payments** in v1 | joseleos | |
| 2026-08-30 | LLM use (Claude API for line-item classification) covered by a privacy statement; no rules-only mode required | joseleos | |
| 2026-08-30 | Release bar for v1: **demo only** (not private beta, not public launch) | joseleos | Sets M3 |
| 2026-08-30 | Launch audience: site-civil / land-development PEs at 1–25-person firms | joseleos | |
| 2026-08-30 | Pricing hypothesis $100–300/mo; $0 marketing budget, organic only | joseleos | Validate WTP via smoke test (Researcher) |
| 2026-08-30 | Verbatim pain quotes: joseleos sourcing civil engineers to interview; GTM content gated on those | joseleos | |
| 2026-08-30 | Parallel ordering: HermesX research brief + GTM plan now; Scribe content after M1 screenshots | joseleos | |
| 2026-08-30 | Default stack: TypeScript + Next.js, Postgres, Claude API, PDF/XLSX export libs; hosted, cheap | Claude | Inherited default, joseleos may veto |
| 2026-08-30 | Stage A objections (PR #1, Codex) accepted in full: owner/member roles + expiring single-use invites; firm section templates snapshotted per estimate; persisted import mappings + preview before mutation; stable project-level `cost_items` for delta identity; immutable price catalogs + per-line provenance snapshot; matcher interface with pinned model + deterministic fake, eval separated from CI; milestone+revision uniqueness; ExcelJS only; Drizzle | Claude | `product/ARCHITECTURE.md` v2 |
| 2026-08-30 | Seed unit-price source: **TxDOT Bid Tabulations on data.texas.gov (Socrata `de7b-7dna`)**, quantity-weighted avg of low-bid unit prices per bid code per district, trailing 12 months; legacy TxDOT pages/FTP rejected as stale (2016 data); Tableau dashboard used only as cross-check | Claude | `research/txdot/TXDOT_SOURCE_SPIKE.md` |
| 2026-08-30 | Negative quantities rejected in v1 (no credit lines) | Claude | Overridable by joseleos |
| 2026-08-30 | Seed prices always carry attribution on exhibits ("TxDOT Bid Tabulations via data.texas.gov, <district>, <window>, retrieved <date>") | Claude | No attribution requirement found; done for defensibility |
