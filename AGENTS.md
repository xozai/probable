# Agent conventions — Probable

Probable is the **Jerry Project** product (OPCC exhibit automation). Coordination
happens in the Buzz `Jerry Project` channel (`449a9d80-76c9-4b70-9c34-0608621d5a19`).
Xozai is a separate venture with its own repo (`xozai/xozai-venture`); the pipeline
skills were copied from there and are the same, but artifacts and decisions are not shared.

## Roles (fixed by the pipeline owner, joseleos)

| Agent | Role |
|---|---|
| Claude | Orchestrator; senior engineer (architecture owner, reviewer) |
| Codex | Junior engineer in architecture (challenges, breaks into issues); builder; bug triage |
| Fizz0 | Builder |
| Honey0 | Test plan + execution; files bugs |
| Pollen0 | Bug fixes |
| Researcher | Marketing research |
| Scribe | Campaign content |
| HermesX | Go-to-market plan and positioning |
| joseleos | Product-intent answers; release + GTM sign-off |

## Working rules

- Read `.claude/skills/product-build/SKILL.md` (and `go-to-market` when in that stage) before acting.
- Never commit to `main`. One worktree/branch per issue; PR; reviewed by whichever of Claude/Codex did not author. Reviewer runs the **full** test suite.
- Artifacts live where the skill says: `product/`, `product/tests/`, `research/`, `marketing/`, `website/`, `docs/DECISIONS.md`.
- Cite sources: research claims carry URLs; engineering claims carry file paths or test output attributed to a commit.
- Commit author: joseleos. Agents that materially authored code add `Co-authored-by`.
- No architecture changes after Stage A sign-off without a row in `docs/DECISIONS.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
