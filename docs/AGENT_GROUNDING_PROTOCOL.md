# Agent Grounding Protocol

Scope: all AI/code agents working in this repository.

Purpose: keep agents anchored to Medusa v2.13.1 patterns, repo-specific architecture, and proven verification standards so changes are safe and repeatable.

## 1. Mandatory Read Order (Do Not Skip)
1. Read `AGENTS.md` at repo root, then nearest nested `AGENTS.md` in your working area.
2. Read `medusadocs/INDEX.md` and follow `medusadocs/00_START_HERE/DECISION_TREE.md` to task-specific docs.
3. For backend work, read `MEDUSA_V2_CONTEXT.md` before proposing or writing code.
4. For admin login/render work, read `docs/ADMIN_PANEL_MISTAKE_LEDGER.md` before debugging.
5. If uncertainty remains after targeted docs, search `llms-full.txt` with focused queries (never read sequentially).

## 2. Task Routing (Progressive Disclosure)
- System understanding: `medusadocs/01_CONTEXT/YOUR_CODEBASE.md`
- New module/entity: `medusadocs/02_BUILDING/MODULES.md`
- New workflow/business process: `medusadocs/02_BUILDING/WORKFLOWS.md`
- New API route: `medusadocs/02_BUILDING/API_ROUTES.md`
- Admin customization: `medusadocs/02_BUILDING/ADMIN_UI.md`
- Auth/security/compliance: `medusadocs/02_BUILDING/AUTH_SECURITY.md`
- Error/debugging: `medusadocs/03_REFERENCE/TROUBLESHOOTING.md`
- Pattern lookup: `medusadocs/03_REFERENCE/ALL_PATTERNS_INDEX.md`

## 3. Medusa v2 Hard Guardrails
- No new legacy logic in `src/services`.
- No Express `router.use` style route registration for v2 routes.
- API handlers must be file-based under `src/api/**/route.ts` with `GET/POST/...` exports.
- Business logic must live in modules and workflows (`src/modules`, `src/workflows`).
- Cross-module behavior should use Query/workflows/links, not direct module coupling.
- If backend hangs on startup, check Redis and database connectivity first.
- **CRITICAL: Port 9000 is reserved for the USER's IDE. NEVER kill processes on port 9000 and DO NOT attempt to use port 9000 for Medusa or any other services.**

## 4. Serena Usage Policy
Use Serena as the default for semantic navigation when architecture or symbol relationships matter.

Use Serena first for:
- finding definitions/references across module boundaries,
- tracing workflow or route call chains,
- understanding how a symbol is used before refactoring,
- updating Serena memories after major lessons.

Use fast text search (`rg`) for:
- literal string searches,
- quick file discovery,
- known path checks.

Rule: do not rely only on grep-style scanning for high-risk backend changes when Serena symbol tools can reduce ambiguity.

## 5. `llms-full.txt` Escalation Policy
- Treat `medusadocs/` as the first source for implementation.
- Escalate to `llms-full.txt` only when:
  - a needed API/pattern is not covered in `medusadocs`,
  - there is conflict between docs and observed code behavior,
  - advanced edge-case behavior is required.
- Query `llms-full.txt` with narrow searches (for example: `rg "createRemoteLinkStep|when\\(" llms-full.txt`).
- If a new high-value pattern is found, add it back into `medusadocs` so future tasks do not re-open the same gap.

## 6. Verification Standard (Evidence Before Claims)
- Never claim success from URL/navigation changes alone.
- Admin/login fixes require all of the following in one run:
  1. post-login UI visibly rendered,
  2. no critical runtime/browser errors,
  3. auth flow success (`/auth/user/emailpass`, `/auth/session`),
  4. repeatability in at least two clean runs.
- For non-admin changes, run lint/typecheck/tests relevant to the touched scope.

## 7. Learning Loop (Prevent Repeat Mistakes)
When a bug, near miss, or high-risk discovery occurs:
1. Add or update an entry in `docs/ADMIN_PANEL_MISTAKE_LEDGER.md` (or relevant runbook) with:
   - trigger/symptom,
   - root cause,
   - verified fix,
   - prevention rule.
2. If the lesson changes agent behavior, update:
   - root or nested `AGENTS.md`,
   - `claude.md`,
   - relevant `.serena/memories/*.md`.
3. Prefer small, explicit guardrails over long narratives.

## 8. Source of Truth Priority
When guidance conflicts, resolve in this order:
1. Current code behavior in repository paths.
2. Scoped `AGENTS.md` instructions.
3. `MEDUSA_V2_CONTEXT.md` and this grounding protocol.
4. `medusadocs/` task documents.
5. `llms-full.txt` targeted excerpts.

