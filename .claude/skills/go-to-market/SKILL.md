---
name: go-to-market
description: >
  Take the shipped product to market. Hermes owns the GTM plan and positioning,
  Researcher supplies marketing research, Scribe produces campaign content.
  Gated: no copy until audience, replaced incumbent, and verbatim quotes exist.
version: 1
---

# Skill 3 — Go-to-market

## When to run
After `product-build` tags a release candidate (M3) — GTM planning can overlap
the fix loop; content production waits for real screenshots.

## Roles
| Who | Does |
|---|---|
| Hermes | GTM plan, positioning, pricing recommendation, channel sequencing |
| Researcher | Any research Hermes requests: audience sizing, incumbent pricing, venue lists, quote collection |
| Scribe | All campaign content: site copy, emails, webinar outline, social, one-pager |
| Claude | Orchestrator; builds `website/` from Scribe's copy with Codex/Fizz0 if needed |
| joseleos | Signs off the GTM plan, then the content |

## Gate — do not draft content until all three exist
1. **Named audience**: discipline + role + firm size (e.g. "site-civil PEs at
   5–50 person land-development firms").
2. **The named incumbent or workaround being replaced** (e.g. "the OPCC Excel
   workbook you re-key from Civil 3D every milestone").
3. **Verbatim pain quotes** with sources, from `research/`.
Copy written without these is filler. Hermes confirms the gate is met in the
channel before Scribe starts.

## Sequence (order is mandatory — reversed, everything gets rewritten)
1. **Research brief** — Hermes lists questions; Researcher answers in
   `marketing/RESEARCH_<topic>.md` with URLs.
2. **GTM plan** — Hermes writes `marketing/GTM_PLAN.md`: audience, positioning
   statement, wedge narrative (one sentence, names no unwinnable competitor),
   pricing, channel plan with sequencing and budget, 90-day targets, metrics.
   joseleos signs off. Record in `docs/DECISIONS.md`.
3. **Content** — Scribe produces from the approved plan into `marketing/content/`:
   - Landing page copy (headline from a verbatim quote, before/after in one
     screenshot).
   - Launch email sequence (3 emails).
   - PDH webinar title, abstract, outline.
   - PE-society newsletter blurb, 2 forum-appropriate posts, 5 social posts.
   - One-pager PDF copy.
4. **Website** — Claude/Codex build `website/` from the landing copy; deploy
   preview; Scribe reviews rendered copy.
5. **Sign-off** — joseleos approves; campaign calendar in `marketing/CALENDAR.md`.

## Civil-specific channels (hard-coded, use before generic playbooks)
- **PDH-credit webinars** — PEs need continuing-education hours to keep their
  license and will attend vendor webinars to earn them. The highest-leverage
  top-of-funnel motion in this vertical; plan one in the first 60 days.
- State PE society newsletters; ASCE branch meetings.
- Eng-Tips forums; r/civilengineering (follow community rules, lead with the
  workaround story, not the product).
- YouTube tutorial SEO — "how do I do X in Civil 3D / Excel".
- Discipline conferences: TRB, WEFTEC, Bentley YII, Autodesk University, ASCE
  Convention — choose by the discipline tag from discovery.

## Outputs
- `marketing/GTM_PLAN.md`, `marketing/RESEARCH_*.md`, `marketing/content/*`,
  `marketing/CALENDAR.md`, `website/`.

## Anti-patterns
- Positioning as "a better Civil 3D" or "a better <incumbent>".
- Content before plan sign-off.
- Paraphrasing the quotes.
- Treating market size as a marketing argument.
