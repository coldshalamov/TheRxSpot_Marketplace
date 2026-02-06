# Project Overview: TheRxSpot Marketplace

TheRxSpot Marketplace is a multi-tenant telehealth commerce and operations platform.
It combines a Medusa v2 backend with a Next.js storefront and operational launch tooling
for local full-stack workflows.

## Core Mission
- System of record for order, tenant, and operational state.
- Reliable workflows for consultation-gated product purchases.
- White-label tenant model with configurable branding and catalog isolation.

## Primary Tech
- Backend: Medusa v2.13.1 (`@medusajs/framework`, `@medusajs/medusa`).
- Storefront: Next.js 15 (`TheRxSpot_Marketplace-storefront/`).
- Data: PostgreSQL + Redis.
- Language: TypeScript (plus PowerShell launcher tooling).

## Monorepo Map
- `src/`: Medusa backend (API routes, modules, workflows, admin custom routes).
- `TheRxSpot_Marketplace-storefront/`: customer-facing app and tenant-aware UI.
- `docs/`: architecture, API reference, runbooks, incident/mistake ledgers.
- `scripts/`: diagnostics and bridge automation (including Serena bridge tooling).
- launchers at repo root: `Launch-Admin-Only.ps1`, `Launch-Marketplace.ps1`, dependency starters.

## High-Signal Files
- `AGENTS.md`: root operating instructions and module map.
- `MEDUSA_V2_CONTEXT.md`: mandatory Medusa v2 rules (do not use v1 patterns).
- `medusa-config.ts`: module registration + `admin.path` (currently `/app`).
- `docs/ADMIN_PANEL_MISTAKE_LEDGER.md`: admin stability evidence standard.
- `docs/ARCHITECTURE.md`: system-level architecture and domain model context.

## Runtime Notes
- Backend commonly starts on `9000` (fallback `9001`).
- Storefront commonly starts on `8000` (fallback `8001`).
- Backend/storefront URL and port must stay synchronized via env and launchers.
