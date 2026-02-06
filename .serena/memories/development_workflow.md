# Development Workflow

## 1. Pre-Flight
- Read root `AGENTS.md` first, then nearest scoped instructions (`src/AGENTS.md`, `TheRxSpot_Marketplace-storefront/AGENTS.md`, `docs/AGENTS.md`).
- Read `docs/AGENT_GROUNDING_PROTOCOL.md`.
- Route through `medusadocs/INDEX.md` and `medusadocs/00_START_HERE/DECISION_TREE.md` for task-specific docs.
- For backend tasks, read `MEDUSA_V2_CONTEXT.md` before editing.
- For admin render/login issues, read `docs/ADMIN_PANEL_MISTAKE_LEDGER.md` before proposing fixes.
- Escalate to targeted `llms-full.txt` search only when curated docs are missing required detail.

## 2. Local Startup Order
- Start infrastructure first: `Start-Dependencies.ps1` or `Start-Dependencies.bat`.
- Prefer launcher scripts for coordinated startup:
  - admin-focused: `Launch-Admin-Only.ps1`
  - full stack: `Launch-Marketplace.ps1`
- Confirm backend health before UI work: `http://localhost:<backendPort>/health`.

## 3. Implementation Pattern
- Backend:
  - routes in `src/api/**/route.ts` (`GET`, `POST`, etc. exports).
  - business logic in modules/workflows (`src/modules`, `src/workflows`), not legacy services.
- Storefront:
  - keep backend URL env aligned (`MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_MEDUSA_BACKEND_URL`).
  - maintain tenant-aware behavior and avoid hardcoding backend host/port.

## 4. Verification Pattern
- Minimal per change:
  - run lint + typecheck for touched module(s),
  - run relevant tests or smoke diagnostics.
- For admin fixes, proof must include:
  1. visibly rendered post-login UI,
  2. no critical runtime/browser errors,
  3. successful auth flow,
  4. repeatability (2 clean runs).

## 5. Safe Working Rules
- Keep diagnostics and generated artifacts outside watched source folders.
- Keep changes small, scoped, and reversible.
- Do not claim success based on URL changes alone.
- Use Serena symbol-aware tools for high-risk semantic analysis, and use `rg` for literal/path lookup.
