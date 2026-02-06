# Module and Feature Map

## Backend (`src/`)
- `src/api/`
  - HTTP entrypoints (store/admin routes, middleware).
- `src/admin/`
  - admin app custom routes/extensions.
- `src/modules/`
  - domain modules:
    - `business`
    - `consultation`
    - `financials`
    - `compliance`
- `src/workflows/`
  - cross-module business orchestration and write flows.
- `src/jobs/`, `src/subscribers/`
  - async/event-driven behaviors.

## Storefront (`TheRxSpot_Marketplace-storefront/`)
- customer UI + tenant-aware rendering.
- backend integration via `MEDUSA_BACKEND_URL` and `NEXT_PUBLIC_MEDUSA_BACKEND_URL`.
- includes browser-based admin diagnostics and Playwright tooling.

## Operations and Docs
- `docs/`
  - architecture references, API docs, runbooks, incident learning.
- root launch scripts + `scripts/`
  - startup orchestration and smoke diagnostics.
- `scripts/serena-gpt-bridge/`
  - Serena MCP bridge, worker proxy scaffolding, session lifecycle scripts.

## High-Risk Areas Requiring Extra Verification
- Admin login/render flows.
- Cross-domain workflows touching consultation/order/financial state.
- Any launcher/runtime port/path behavior changes.
