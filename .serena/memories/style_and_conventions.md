# Code Style and Conventions

## Language and Tooling
- TypeScript-first codebase.
- PowerShell for launcher/orchestration scripts.
- ESLint + TypeScript checks are required quality gates before completion claims.

## Medusa v2 Architecture Conventions
- Use `src/modules` + `src/workflows` for business logic.
- Use `src/api/**/route.ts` handlers instead of Express router wiring.
- Prefer Query/workflow-based cross-domain interactions.
- Avoid v1 patterns:
  - no new `src/services` monolith logic,
  - no `router.use`-style route composition.

## Naming and Organization
- Keep module boundaries clear by domain (`business`, `consultation`, `financials`, `compliance`).
- Keep migrations timestamp-prefixed.
- Keep feature code close to domain paths; avoid ambiguous utility dumping.

## Storefront Conventions
- Next.js App Router conventions apply.
- Maintain tenant-aware flows (business context, branding, backend URL synchronization).
- Do not assume fixed backend URL/port in code.

## Verification and Safety Conventions
- Do not mark issues fixed from navigation/URL-only checks.
- For admin stability regressions, enforce the ledger evidence standard in one run.
- Preserve launcher/runtime alignment (ports + `admin.path`).
