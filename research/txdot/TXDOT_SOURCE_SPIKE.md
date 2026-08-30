# A1 — TxDOT unit-price source spike (Stage A gate)

Run by Claude, 2026-08-30. Status: **complete — source selected, fixture checked in.**

## Candidates examined

| Source | Verdict | Evidence |
|---|---|---|
| Legacy "Average Low Bid Unit Price" HTML pages (`https://www.dot.state.tx.us/insdtdot/orgchart/cmd/cserve/bidprice/s_0101.htm`, district variants `…/geodist/<dist>/cserve/bidprice/…`) | **Stale — reject.** Page says "Last Update Aug 08 2024" but data column is "December 31, 2016 Twelve-Month-Moving" | curl, 2026-08-30 |
| Legacy FTP XLS/TXT archive (`https://ftp.txdot.gov/pub/txdot-info/cmd/cserve/`, `…/distinfo/bidprice/excel/`) | **Stale — reject.** Newest files 2015; `excel/` zips dated 2019-02-01 | FTP listing |
| TxDOT Tableau "Bid Item Averages" dashboard (`https://tableau.txdot.gov/views/BidItemAverageCost/BidItemAvgCostDashboard`) | **Not machine-readable — reject for ingestion.** 24-month window, updates daily 06:00, statewide + district; no documented export; headless fetch returns Tableau error shell. "For informational purposes only." Useful as a *cross-check* of our computed averages. | `https://www.txdot.gov/business/road-bridge-maintenance/contract-letting/bid-items-and-index.html` |
| **Texas Open Data Portal — "Bid Tabulations" (Socrata `de7b-7dna`)** | **SELECTED.** | below |
| Texas Open Data Portal — "Official and Unofficial Bid Items" (`qh8x-rm8r`) | Complementary: proposal-side quantities + engineer's estimates for upcoming lettings. Not needed for v1. | Socrata metadata |

## Selected source: Bid Tabulations, `https://data.texas.gov/dataset/Bid-Tabulations/de7b-7dna`

- **API:** Socrata SODA — `https://data.texas.gov/resource/de7b-7dna.json` (CSV via `.csv`). SoQL `$select/$where/$group` supported; anonymous access works; app token optional (raises rate limit).
- **Format:** one row per (letting, bidder, bid item). Key fields: `bid_code` (e.g. `110-7001`), `bid_item_description`, `measurement_unit`, `bid_item_quantity`, `bid_item_unit_price_amount`, `low_bidder_flag`, `district_division`, `county`, `project_actual_let_date`, `engineer_s_estimate_unit`, `spec_book_year`, `vendor_name`, `control_section_job_csj`.
- **Volume / freshness (queried 2026-08-30):** 1,081,181 rows; `rowsUpdatedAt` 2026-08-28 19:43 UTC; low-bid rows span let dates 2024-08-01 → 2026-08-25 (166,052 rows). Rolling ~24-month window, same as the dashboard.
- **Cadence:** portal updates daily (dashboard job aid: daily 06:00 from TxDOTCONNECT).
- **Geographic grain:** 25 districts + Maintenance Division. Trailing-12-month low-bid row counts: Dallas 8,748; San Antonio 7,284; Houston 6,930; Fort Worth 5,349; Austin 5,199; smallest Childress 876. County is also present → county-level grain possible later.
- **Reuse terms:** Data are public records of public lettings published by a state agency on the state open-data portal (Socrata platform ToS `http://www.socrata.com/terms-of-service`; portal contact `txopendataportal@dir.texas.gov`). TxDOT's site disclaimer (`https://www.txdot.gov/about/disclaimer.html`) makes no accuracy warranty. No attribution *requirement* found; **we attribute anyway** ("Source: TxDOT Bid Tabulations via data.texas.gov, retrieved YYYY-MM-DD") on every exhibit that uses seed prices. Item: confirm in writing with DIR before any public launch (not needed for demo).
- **Caveats:** unit prices are highway-letting prices (TxDOT spec items), not private site-development prices — an *anchor*, not a quote. Simple averages are dominated by small-quantity outliers (see fixture: EXCAV (ROADWAY) simple avg $29.35/CY vs quantity-weighted $12.78/CY). Use **quantity-weighted average of low-bid unit prices** as the headline, show `n` and simple avg alongside. Lump-sum items (LS, e.g. MOBILIZATION) are not comparable across projects and must be flagged.

## Normalization (catalog build)

```
catalog = (source='txdot_bid_tabs', geography=<district|statewide>, window=[from,to], retrieved_at, source_url, row_count, sha256)
entry   = bid_code, description, unit, wavg_unit_price, simple_avg_unit_price, n_low_bids, total_qty
```
SoQL used for the fixture (Houston district, let dates 2025-09-01 … 2026-08-31, low bidder only, qty > 0):
```
$select=bid_code,bid_item_description,measurement_unit,sum(bid_item_quantity) as total_qty,
        sum(bid_item_quantity*bid_item_unit_price_amount)/sum(bid_item_quantity) as wavg_unit_price,
        avg(bid_item_unit_price_amount) as simple_avg_unit_price,count(*) as n_low_bids
$where=low_bidder_flag=true AND district_division='Houston' AND project_actual_let_date between '2025-09-01T00:00:00' and '2026-08-31T23:59:59' AND bid_item_quantity>0
$group=bid_code,bid_item_description,measurement_unit
```

## Checked-in fixture

- `research/txdot/houston_low_bid_avg_2025-09_2026-08.json` / `.csv` — **2,005 entries**, retrieved 2026-08-30.
- CSV sha256 `7f69ddc0c7ec31db18dc0a1260c005e9414c6194d1b9a169dc5cf35dd7b251a7`.
- Spot values: 110-7001 EXCAV (ROADWAY) CY wavg 12.78 (n=16); 464-7001 RC PIPE (CL III)(12 IN) LF 54.00 (n=1); 500-7001 MOBILIZATION LS 491,512 (n=87, flag LS).

AC10 becomes: importer loads exactly the fixture's row count with matching checksum, fails closed otherwise.
