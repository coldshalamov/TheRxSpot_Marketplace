# Suggested Commands for TheRxSpot Marketplace

## Backend (Root Directory)
- `npm run dev`: Starts the Medusa development server.
- `npm run build`: Builds the project.
- `npm run db:clean-migrate`: Cleans and runs database migrations (useful for resets).
- `npm run seed`: Seeds the database with default data.
- `npm run seed:therxspot`: Seeds the database specifically for TheRxSpot.
- `npm run test`: Runs the main integration tests.
- `npm run lint`: Runs ESLint on the backend and scripts.
- `npm run check`: Runs lint, typecheck, build, and storefront checks.
- `powershell -ExecutionPolicy Bypass -File .\Launch-Admin-Only.ps1`: Start admin-focused local stack.
- `powershell -ExecutionPolicy Bypass -File .\Launch-Marketplace.ps1`: Start full local stack.

## Storefront (`TheRxSpot_Marketplace-storefront` Directory)
- `npm run dev`: Starts the Next.js development server (runs on port 8000).
- `npm run build`: Builds the production storefront.
- `npm run lint`: Runs ESLint on the storefront.
- `npm run type-check`: Runs TypeScript type checking.

## System Utilities (Windows)
- `git status`, `git diff`, `git log`: Standard Git operations.
- `powershell -ExecutionPolicy Bypass -File <script>`: For running .ps1 helper scripts.
- `Launch-Marketplace.ps1`: Comprehensive launcher for the entire stack.

## Debugging/Verification
- `Invoke-WebRequest http://localhost:9001/health -UseBasicParsing`: Quick backend health probe.
- `node .\TheRxSpot_Marketplace-storefront\scripts\admin-login-diagnose.mjs`:
  Browser login diagnostic (set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_URL` env vars).
