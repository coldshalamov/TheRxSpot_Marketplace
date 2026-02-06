# Manual Medusa Startup Guide

The automated launcher may start services before the build completes. Follow these steps to start Medusa manually:

## Prerequisites
1. PostgreSQL running on port 5432
2. Redis running on port 6379

Run `Start-Dependencies.bat` if needed.

## Steps

### 1. Stop All Running Processes
Close all PowerShell windows running npm/node/medusa processes.

### 2. Open TWO PowerShell/Terminal Windows

### Terminal 1: Start Medusa Backend
```powershell
cd D:\GitHub\TheRxSpot_Marketplace
npm run dev
```

**Wait for this message:**
```
Server is ready on: http://localhost:9001
```

This usually takes 15-30 seconds.

### Terminal 2: Start Next.js Storefront
```powershell
cd D:\GitHub\TheRxSpot_Marketplace\TheRxSpot_Marketplace-storefront
npm run dev
```

**Wait for:**
```
- Local: http://localhost:8000
```

## Access Points

Once both services show "ready":

- **Admin Panel**: http://localhost:9001/app
- **Storefront**: http://localhost:8000
- **Backend API**: http://localhost:9001

## Troubleshooting

### If admin panel returns 404:

1. Check Terminal 1 for errors
2. Verify the build completed:
   ```powershell
   ls D:\GitHub\TheRxSpot_Marketplace\.medusa\server\public\admin\index.html
   ```
   This file should exist.

3. If the file doesn't exist, run:
   ```powershell
   cd D:\GitHub\TheRxSpot_Marketplace
   npm run build
   ```

4. After build completes, restart Terminal 1 (Medusa backend)

### Common Errors

**"Cannot find module"**: Run `npm install` in the appropriate directory

**Port already in use**: Another process is using the port. Find and kill it:
```powershell
# Find process on port 9001 (DO NOT KILL PORT 9000 - IT IS THE IDE)
netstat -ano | findstr :9001

# Kill it (replace PID with actual process ID)
taskkill /PID <PID> /F
```

**Database connection error**: Ensure PostgreSQL is running and credentials in `.env` are correct

## First Time Login

When you access http://localhost:9001/app for the first time:

1. You'll see a login/setup screen
2. Follow the onboarding wizard
3. Create your admin user account

## Notes

- Keep both terminal windows open while developing
- Watch for errors in the terminal output
- The first startup takes longer due to database initialization
