# TheRxSpot Marketplace Launcher Guide

## Quick Start

### 1. Start dependencies
Run:

```powershell
.\Start-Dependencies.bat
```

This ensures PostgreSQL (`5432`) and Redis (`6379`) are running.

### 2. Launch the stack
Run:

```powershell
.\Launch-Marketplace.bat
```

The launcher will:
1. Validate dependencies.
2. Build backend assets if needed.
3. Start Medusa backend (prefers `9000`, falls back to `9001` if occupied).
4. Start storefront (prefers `8000`, falls back to `8001` if occupied).
5. Open `Marketplace-Launcher.html` with active ports in URL query params.

### Optional: launch only what you need

Admin only:

```powershell
.\Launch-Admin-Only.bat
```

Storefront only:

```powershell
.\Launch-Storefront-Only.bat
```

`Launch-Admin-Only` pre-warms admin assets and opens admin in a clean Edge InPrivate window with extensions disabled (if Edge is available), which avoids many "blank spinner forever" browser-profile issues.

### 3. Use Command Center links
The launcher tiles show the active ports (for example `:9001` if `:9000` is already used).

## Access Points

- Storefront: `http://localhost:<storefront-port>`
- Admin Panel: `http://localhost:<backend-port>/app`
- Backend health: `http://localhost:<backend-port>/health`

## Troubleshooting

### Admin opens a 404 page
Likely causes:
1. Medusa started on fallback port (`9001`) because `9000` is used by another app.
2. Backend is still starting.
3. Admin build failed.

Run diagnostics:

```powershell
.\diagnose-admin.ps1
```

This script now auto-detects the healthy backend port and prints the correct admin URL.

### Admin stays on spinner / blank screen
Likely causes:
1. Browser extension or stale browser profile state.
2. Backend restarted during first admin load.
3. Cold dev compile still in progress.

Try:
1. Run `.\Launch-Admin-Only.bat` and use the opened InPrivate admin window.
2. If needed, manually open `http://localhost:9001/app` (or printed backend port).
3. Keep the backend terminal visible and ensure no restart loop appears while loading.

### Dependencies are missing
- PostgreSQL not running: start it, then rerun `Start-Dependencies.bat`.
- Redis not running: start it, then rerun `Start-Dependencies.bat`.

### Build failure
Run:

```powershell
npm run build
```

Then relaunch with `.\Launch-Marketplace.bat`.

## Manual Launch (Advanced)

Backend:

```powershell
cd <repo-root>
npm run build
npm run dev
```

Storefront:

```powershell
cd <repo-root>\TheRxSpot_Marketplace-storefront
npm run dev -- -p 8000
```

If ports are busy, use `9001` / `8001` and open matching URLs.
