# Agent Instructions (scope: repository root and all subdirectories)

## Scope and Layout
- This file applies to the whole repo unless a nested `AGENTS.md` overrides details.
- Treat this as a monorepo-style workspace:
  - Medusa backend in `src/`
  - Next.js storefront in `TheRxSpot_Marketplace-storefront/`
  - Operational docs in `docs/`
  - Launch/orchestration scripts at repo root and `scripts/`

## Modules / Subprojects

| Module | Type | Path | What it owns | How to run | Tests | Docs | AGENTS |
|--------|------|------|--------------|------------|-------|------|--------|
| backend | medusa/typescript | `src/` | API routes, admin extensions, modules, workflows/jobs | `npm run dev` | `npm run test`, `npm run test:integration:http`, `npm run lint`, `npm run typecheck` | `docs/ARCHITECTURE.md`, `docs/API_REFERENCE.md` | `src/AGENTS.md` |
| storefront | nextjs/typescript | `TheRxSpot_Marketplace-storefront/` | Customer-facing UI and tenant-aware web app | `npm -C TheRxSpot_Marketplace-storefront run dev` | `npm -C TheRxSpot_Marketplace-storefront run check` | `TheRxSpot_Marketplace-storefront/README.md` | `TheRxSpot_Marketplace-storefront/AGENTS.md` |
| docs | documentation | `docs/` | Runbooks, plans, architecture, API docs | n/a | n/a | `docs/` | `docs/AGENTS.md` |
| launchers | powershell/html | repo root, `launcher_assets/` | Local orchestration and command center UI | `.\Launch-Admin-Only.ps1`, `.\Launch-Marketplace.ps1` | smoke via `npm run diagnose:smoke` | `LAUNCHER_GUIDE.md` | (this file) |

## Mandatory Grounding Sequence (Critical)
1. Read this file, then nearest nested `AGENTS.md`.
2. Read `docs/AGENT_GROUNDING_PROTOCOL.md`.
3. Read `medusadocs/INDEX.md` and route via `medusadocs/00_START_HERE/DECISION_TREE.md`.
4. For backend tasks, read `MEDUSA_V2_CONTEXT.md` before coding.
5. For admin login/render tasks, read `docs/ADMIN_PANEL_MISTAKE_LEDGER.md` before debugging.
6. Escalate to targeted `llms-full.txt` search only when `medusadocs/` lacks required detail.

## Cross-Domain Workflows
- Admin/Backend workflow:
  - Admin app is served by backend (`/app` path from `medusa-config.ts`).
  - Launcher scripts must respect runtime backend port and `admin.path`.
- Storefront/Backend workflow:
  - Storefront reads backend URL from env (`MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_MEDUSA_BACKEND_URL`).
  - Full-stack launch should keep backend and storefront port selection in sync.
- Local startup:
  - Start dependencies first (`Start-Dependencies.ps1` or `.bat`).
  - Prefer launchers for Windows local orchestration.

## Verification Standard (Critical)
- For admin login/render fixes, read `docs/ADMIN_PANEL_MISTAKE_LEDGER.md` first.
- Do not claim success from URL changes alone.
- Minimum proof in one run:
  - post-login UI visibly rendered,
  - no critical runtime/browser errors,
  - auth flow succeeds,
  - behavior is repeatable.

## Global Conventions
- Keep changes scoped and reversible.
- Prefer module-local commands from the relevant nested `AGENTS.md`.
- Do not read the entire `docs/` tree unless the task needs it.
- Prefer Serena semantic navigation for symbol/call-chain understanding; use `rg` for literal lookups.
- **CRITICAL: Port 9000 is reserved for the USER's IDE. NEVER kill processes on port 9000 and DO NOT attempt to use port 9000 for Medusa or any other services.**

## Links to Nested Instructions
- `src/AGENTS.md`
- `TheRxSpot_Marketplace-storefront/AGENTS.md`
- `docs/AGENTS.md`

## Medusa V2 AI Compatibility (CRITICAL)
- **Repo Version**: V2.13.1 (Incompatible with V1).
- **Rule**: ALL AI Agents MUST read `MEDUSA_V2_CONTEXT.md`.
- **Deep Context**: use `medusadocs/` first; use targeted search in `llms-full.txt` for gaps.
- **Instability**: If the server hangs, check Redis (`docker ps`).
- **Patterns**:
  - NO `src/services` (use `src/modules`).
  - NO `router.use` (use `src/api/.../route.ts`).
  - ALWAYS use Workflows for business logic.

## Learning Loop
- When a new mistake/near-miss is discovered, update:
  - `docs/ADMIN_PANEL_MISTAKE_LEDGER.md` (root cause, fix, prevention),
  - this file or nested `AGENTS.md` if the rule should become mandatory,
  - `.serena/memories/*.md` if Serena behavior should change.
- Do not close incidents without recording a reusable prevention rule.
