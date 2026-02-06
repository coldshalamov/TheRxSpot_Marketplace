# Suggested Commands for TheRxSpot Marketplace

## Root / Backend Commands
- `npm run dev` - start Medusa dev server.
- `npm run build` - build backend/admin assets.
- `npm run lint` - lint backend + scripts.
- `npm run typecheck` - backend TypeScript validation.
- `npm run test` - integration HTTP test entrypoint.
- `npm run test:integration:http` - primary backend integration suite.
- `npm run test:consultation` - consultation lifecycle test.
- `npm run test:consult-gating` - consult-gating integration test.
- `npm run diagnose:smoke` - local smoke verifier.
- `npm run check` - lint + typecheck + build + storefront check.

## Data / Setup Commands
- `npm run db:clean-migrate` - reset schema and run migrations.
- `npm run seed` - default seed.
- `npm run seed:therxspot` - TheRxSpot-focused seed.

## Storefront Commands
- `npm -C TheRxSpot_Marketplace-storefront run dev`
- `npm -C TheRxSpot_Marketplace-storefront run build`
- `npm -C TheRxSpot_Marketplace-storefront run typecheck`
- `npm -C TheRxSpot_Marketplace-storefront run check`

## Launcher Commands (Preferred on Windows)
- `powershell -ExecutionPolicy Bypass -File .\Start-Dependencies.ps1`
- `powershell -ExecutionPolicy Bypass -File .\Launch-Admin-Only.ps1`
- `powershell -ExecutionPolicy Bypass -File .\Launch-Marketplace.ps1`

## Serena MCP / Bridge Commands
- `powershell -ExecutionPolicy Bypass -File .\scripts\serena-gpt-bridge\Initialize-Serena-MCP.ps1 -ProjectPath .`
- `powershell -ExecutionPolicy Bypass -File .\scripts\serena-gpt-bridge\Run-Serena-For-GPT.ps1 -ProjectPath .`
- `powershell -ExecutionPolicy Bypass -File .\scripts\serena-gpt-bridge\Stop-Serena-Bridge.ps1`

## Useful Diagnostics
- `Invoke-WebRequest http://localhost:9000/health -UseBasicParsing`
- `Invoke-WebRequest http://localhost:9001/health -UseBasicParsing`
- `node .\TheRxSpot_Marketplace-storefront\scripts\admin-login-diagnose.mjs`
