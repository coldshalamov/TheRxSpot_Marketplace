# Agent Instructions (scope: `TheRxSpot_Marketplace-storefront/` and subdirectories)

## Ownership
- Next.js storefront, tenant-aware customer UI, web runtime behavior.

## Commands (run from this directory)
- Dev: `npm run dev`
- Build: `npm run build`
- Start: `npm run start`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Full check: `npm run check`

## Environment + Integration
- Backend URL env:
  - `MEDUSA_BACKEND_URL`
  - `NEXT_PUBLIC_MEDUSA_BACKEND_URL`
- Default local backend often runs on `9000` or fallback `9001`; keep env aligned with launcher/runtime.

## Testing Notes
- Prefer deterministic smoke checks for critical user flows.
- Playwright is available in this module and can be used for login/render verification.

## Do Not
- Do not assume backend port/path defaults; read runtime config or launcher output.
- Do not mark storefront/backend integration fixed from navigation-only checks.
