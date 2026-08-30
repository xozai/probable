# Jerry Project — Civil Engineering Software Opportunity Scan

Date: 2026-08-30
Author: Researcher
Status: discovery pass 1 (web research only, no primary interviews yet)

## Method
Web research across forums (Eng-Tips, general search proxies for r/civilengineering),
vendor/review sites (Capterra, G2), and startup/funding trackers, spanning six
disciplines: land development/site, transportation, geotechnical, structural,
water/wastewater (stormwater), and construction estimating. Scored candidates on
four axes per joseleos's brief (effort, value, marketability, our buildability),
cross-checked against Scribe's marketability rubric (named pain, time-to-obvious,
buyer=user, channel fit, liability drag, wedge narrative, reference velocity).

## Ranked shortlist

| Rank | Candidate | Effort | Value | Marketability | Our buildability | Competitive intensity |
|---|---|---|---|---|---|---|
| 1 | OPCC / cost-estimate exhibit automation (design-phase) | Low-Med | Med-High | High | High | Low-Med |
| 2 | Traffic Control Plan (TCP) generation (MUTCD) | Medium | High | Med-High | Medium | Medium (1 AI entrant) |
| 3 | Geotechnical boring-log & report automation | Medium | Medium | Medium | Medium-High | High (3+ funded incumbents) |
| 4 | SWPPP/stormwater compliance software | Low-Med | Medium | Medium | Medium | High (crowded, low-price incumbents) |
| 5 | Structural calc-package automation | Medium | Medium | Low-Med (liability drag) | Low-Med | High (4+ incumbents) |
| 6 | Stormwater/hydrology design (HydroCAD-class) | High | High | Low (entrenched, jurisdiction lock-in) | Low | High (industry standard incumbent) |
| 7 | Earthwork/quantity takeoff | High | High | Medium | Low (needs volumetric/CAD engine) | High (AGTEK, Civils.ai, iBeam, Bentley) |
| 8 | Permitting automation (multi-discipline) | Very High | High | Low (procurement/govtech-adjacent) | Low (resource gap vs. funded players) | Very High (PermitFlow $54M Series B) |
| 9 | Drawing review / clash detection / RFI generation | High | High | Medium | Low (vision-heavy, funded competitors) | High (Buildcheck AI $5.9M seed, Helonic) |

## Recommendation: #1, OPCC / cost-estimate exhibit automation

**What it is:** Every land-development and site-civil project produces an
Engineer's Opinion of Probable [Construction] Cost at each design milestone
(30/60/90/100%) — a quantity × unit-price exhibit engineers currently build by
hand in Excel, re-keying quantities off Civil 3D takeoffs and stale unit-price
lists.

**Why it ranks #1:**
- **Named pain, recurring at high frequency** — every civil site-design project
  needs one at every milestone, across every sub-discipline (site dev,
  transportation, water/wastewater all produce OPCCs).
- **Time-to-obvious** — before/after is a single screenshot: messy milestone
  spreadsheet vs. a clean, regionally-priced, stamped-ready cost exhibit.
- **Buyer = user** — individual PE or small-firm principal, card-purchase,
  no procurement cycle.
- **Low liability drag** — OPCCs are explicitly disclaimed as non-binding
  estimates, not stamped design values, so this avoids the trust/liability
  wall that blocks automation of actual engineering calcs.
- **Buildable by a lean AI-native team** — this is fundamentally a rules
  engine (regional unit-price database + quantity list ingestion) with an LLM
  assist for line-item classification and PDF/Excel exhibit generation, not a
  CAD-geometry or FEA problem. No incumbent AI-native player found in this
  specific design-phase niche (existing "AI cost estimating" tools found —
  ProEst, Kreo, Civils.ai — are contractor-bid-estimating tools for
  construction-phase takeoffs, not engineer's-opinion exhibits during design).
- **Channel fit** — PDH webinars, state PE society newsletters, ASCE branch
  meetings (per Scribe's rubric) all apply directly.

**Runner-up: #2, Traffic Control Plan (TCP) generation.** MUTCD is a discrete,
well-documented rule set (good LLM/template fit), high per-project frequency,
buyer is a traffic-control company or small transportation firm (direct
sale). One AI entrant found (Mastt AI) — moderate rather than low
competition. Requires more build effort than #1 (diagram/CAD generation, not
just tabular output), and a PE stamp is typically required on the plan
itself even though the layout generation is the time sink.

## Notes for Scribe (per your data-capture request)

- **Verbatim pain quotes found so far** (attributable, will keep collecting):
  - Structural: *"It shouldn't take four days and 50 YouTube videos to model a
    basic wood frame"* — Eng-Tips forum member, re: software usability.
  - Geotechnical: field teams report *"hours lost to retyping data before
    analysis can even begin"* and ~$7/log in wasted wages from manual
    re-entry across field/lab/report stages (vendor-published, treat as
    directional not neutral).
- **Current workaround for OPCC pick:** ad hoc Excel workbooks per firm,
  manually re-keyed from Civil 3D quantity takeoffs against static or
  memorized unit-price lists; no dominant incumbent tool.
- **Named incumbents + pricing surfaced this pass:**
  - Geotechnical: TabLogs, BoreDM, Aldoa (gINT replacement), SO-Log.
  - SWPPP: 4RIVRS, Ecesis, SW².
  - Structural calc: Calcs.com, struct.digital, SkyCiv, StruCalc, ENERCALC.
  - Stormwater/hydrology: HydroCAD (industry standard), Hydrology Studio.
  - Earthwork takeoff: AGTEK, Earthworks OS, Civils.ai, iBeam (Beam AI).
  - Permitting: PermitFlow ($54M Series B, Accel/Kleiner/Felicis), Permitify
    (YC).
  - Drawing review/RFI: Buildcheck AI ($5.9M seed, 10-35x ROI claims,
    AvalonBay customer), Helonic (Procore/Autodesk integration).
  - Traffic control plans: Mastt AI, PurposeBuilt DTCD, Transoft, Autodesk
    Civil 3D (native).
- **Discipline tag for #1 pick:** land development / site-civil (cross-cuts
  transportation and water/wastewater as a shared deliverable type).
- **Discipline tag for #2 pick:** transportation.

## Discovery pass 2 — targeted forum pass + dollar-authority sizing (2026-08-30)

**OPCC verbatim pain quotes: not found, and I want to flag why rather than
quietly drop it.** I ran ~10 search variants (Eng-Tips, r/civilengineering,
general forum phrasing) and fetched two Eng-Tips threads directly.
Reddit blocks direct fetch entirely (`www.reddit.com` fetch refused); Eng-Tips
thread fetches returned HTTP 403 on both attempts. Search-engine snippets
for this topic consistently surface legal/definitional content (why
"opinion" replaced "estimate" for liability reasons) rather than practitioner
complaints — that in itself is a signal: **the terminology exists specifically
to manage liability exposure around a number engineers know is imprecise**,
which is indirect but real evidence of category-wide friction. I could not
convert that into an attributable quote this pass. Getting real quotes now
needs either (a) an authenticated/logged-in pass through Eng-Tips or
r/civilengineering rather than search-engine indexing, or (b) directly
posting a question to those communities and collecting responses — both are
a different tool than what I have. Flagging as a **hard gap**, not a soft one.

**Quantified value-prop anchor (secondary source, not a quote):** per
Buildxact's estimating-software content, "estimating software can get the
job done around 80% quicker and is more accurate" than manual takeoff/pricing
— directionally consistent with the OPCC thesis (re-keying quantities into
spreadsheets is the time sink) but it's a vendor content claim, not a
practitioner data point. Treat as illustrative only.

**Dollar-authority sizing — buyer economics, both picks:**
- Industry structure: fewer than 8% of civil engineering firms employ more
  than 25 people — the buyer universe is overwhelmingly principal-led small
  shops, confirming the "buyer = user, card purchase" assumption rather than
  just asserting it.
- Small-firm revenue benchmark: ~$600K/year for small firms; average civil
  firm ~$7.8M/yr across ~30 staff; revenue-per-employee $180–250K
  industry-wide ($190K average, $228K+ for top-quartile A&E firms).
- Small-business software/IT spend benchmark: 3.4–6% of annual revenue.
  Applied to a $600K solo/small shop, that's a **~$20K–36K/year total
  software budget** — a $100–300/month vertical SaaS tool is a rounding
  error inside that, not a purchase requiring approval workflow.
- Existing spend anchor: firms already pay ~$275/month per seat for Civil 3D
  alone, so a $100–300/month OPCC or TCP tool sits inside a price band firms
  are already conditioned to pay monthly, card-on-file, for design software.
- **TCP-specific pricing anchor (new, addresses old gap):** at least one
  traffic-control-plan provider prices at **$75/sheet minimum**; PE
  stamp/review fees separately run **$500–2,000** per stamped set. This
  confirms TCP buyers transact in the low-hundreds-to-low-thousands range
  per project — well within individual/small-firm purchasing authority, no
  procurement gate. This is a project-service pricing anchor, not
  competitor SaaS pricing (no dedicated TCP-generation SaaS pricing found
  publicly) — useful as a willingness-to-pay ceiling, not a comp.
- No dollar-authority difference found between the two picks that would
  change the ranking — both clear the "card-purchase, no procurement"
  bar comfortably.

## Updated recommendation
No change to the pick. **#1 (OPCC automation) still leads** on effort/value/
marketability/buildability; the dollar-authority pass reinforces it (buyer
economics support a $100–300/mo SaaS price point for either pick, with no
budget-authority reason to prefer #2). The one open item — attributable
primary-source OPCC pain quotes — is a **research-method gap, not a
signal-strength gap**: indirect evidence (liability-driven terminology
shift, universal task frequency, absence of a dedicated competitor) is
consistent and points the same direction across two independent search
passes. Recommend locking #1 on current evidence unless the team wants to
invest in a live outreach pass (e.g., a short post/poll to
r/civilengineering or Eng-Tips) to convert indirect signal into quotable
copy for Scribe.

## Open gaps before this is decision-ready
- Attributable, verbatim OPCC-specific pain quotes — needs live outreach
  (forum post/poll) or authenticated access, not more search. See above.
- Named incumbent SaaS pricing still not found for #1 or #2 specifically
  (no dedicated competitor exists to price against — treated as a
  greenfield-pricing signal, not a data gap).
