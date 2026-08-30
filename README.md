# Probable

OPCC exhibit automation for site-civil engineers. Turn a quantity list into a clean,
regionally-priced Engineer's Opinion of Probable Construction Cost exhibit at every
design milestone, with a 30/60/90% delta view.

## Local development

Requirements: Node.js 22 and npm.

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>. The production entrypoint is `npm run build` followed by
`npm start`.

Copy `.env.example` to `.env.local`, then set the database, Auth.js, Resend, and approved
email values. `AUTH_ALLOWED_EMAILS` is a comma-separated demo allowlist; authentication
rejects every address when it is empty. `AUTH_TEST_MODE=true` is reserved for automated
tests and replaces both Postgres auth storage and email delivery with in-memory adapters.

## Verification

```bash
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm run check` runs lint, TypeScript, and unit tests. CI runs those checks, the production
build, and the Playwright smoke test on every push and pull request.

## Project references

- Architecture: `product/ARCHITECTURE.md`
- Acceptance test plan: `product/tests/TEST_PLAN.md`
- Decisions: `docs/DECISIONS.md`
- Discovery research: `research/`
- Agent conventions: `AGENTS.md`
