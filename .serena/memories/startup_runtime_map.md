# Startup and Runtime Map

## Preferred Startup Sequence (Windows Local)
1. Start infra dependencies:
   - `Start-Dependencies.ps1` or `Start-Dependencies.bat`
2. Start application stack:
   - admin-focused: `Launch-Admin-Only.ps1`
   - full stack: `Launch-Marketplace.ps1`

## Typical Ports
- Backend: `9001` (fallback `9002`).
- Storefront: `8000` (fallback `8001`).
- **CRITICAL: Port 9000 is reserved for User IDE. NEVER use or kill processes on this port.**

## Path and URL Truth Sources
- `medusa-config.ts`:
  - `admin.path` (currently `/app`)
  - backend URL config values.
- Storefront env:
  - `MEDUSA_BACKEND_URL`
  - `NEXT_PUBLIC_MEDUSA_BACKEND_URL`

## Operational Alignment Rules
- Keep launcher-selected backend port aligned with storefront env.
- Do not hardcode admin route path where `medusa-config.ts` already defines it.
- Verify health endpoint stability before deeper frontend/admin diagnostics.
