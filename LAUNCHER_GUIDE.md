# TheRxSpot Marketplace - Setup Guide

## 🚀 Quick Start (3 Steps)

### Step 1: Install Dependencies (One-Time Setup)

You need **PostgreSQL** and **Redis** running for the marketplace to work.

#### Option A: Using Docker (Recommended - Easiest)
```powershell
# Start PostgreSQL
docker run -d --name therxspot-postgres `
  -e POSTGRES_USER=medusa `
  -e POSTGRES_PASSWORD=medusa `
  -e POSTGRES_DB=medusa `
  -p 5432:5432 `
  postgres:15

# Start Redis
docker run -d --name therxspot-redis `
  -p 6379:6379 `
  redis:latest
```

#### Option B: Native Installation
- **PostgreSQL**: Download from https://www.postgresql.org/download/windows/
  - During install, set password to `medusa`
  - Note the port (default: 5432)
  
- **Redis**: 
  - **Windows**: Install Memurai from https://www.memurai.com/
  - **WSL2**: `sudo apt install redis-server && sudo service redis-server start`

### Step 2: Start Dependencies

Double-click: **`Start-Dependencies.bat`**

This script will:
- ✅ Check if PostgreSQL is running
- ✅ Check if Redis is running
- ✅ Start them if they're stopped
- ✅ Provide helpful error messages if not found

### Step 3: Launch the Marketplace

Double-click: **`Launch-Marketplace.bat`**

This will:
1. ✅ Verify dependencies are running
2. ✅ Build the backend (first time only)
3. ✅ Start Medusa Backend on port 9000
4. ✅ Start Next.js Storefront on port 8000
5. ✅ Open the Command Center in your browser

---

## 📍 Access Points

Once launched, you can access:

- **🌐 Storefront**: http://localhost:8000 (Customer-facing shop)
- **⚙️ Admin Panel**: http://localhost:9000/app (Manage products, orders)
- **📱 Command Center**: Opens automatically (Quick links dashboard)

---

## ❓ Troubleshooting

### "PostgreSQL is not running on port 5432"
**Solution**: Run `Start-Dependencies.bat` first

### "Redis is not running on port 6379"
**Solution**: Run `Start-Dependencies.bat` first

### Admin Panel shows 404
**Causes**:
1. Backend is still starting up (wait 30-60 seconds)
2. Database not initialized
3. Build failed

**Solution**: 
1. Check the Medusa Backend terminal window for errors
2. Visit http://localhost:9000/health - should show healthy status
3. If build failed, try manually: `cd d:\GitHub\TheRxSpot_Marketplace && npm run build`

### "Build failed"
**Solution**:
1. Make sure Node.js 20+ is installed: `node --version`
2. Delete `node_modules` and reinstall: 
   ```bash
   cd d:\GitHub\TheRxSpot_Marketplace
   rm -rf node_modules
   npm install
   npm run build
   ```

---

## 🛠️ Manual Commands (Advanced)

If the launcher doesn't work, you can run manually:

```powershell
# Terminal 1: Backend
cd d:\GitHub\TheRxSpot_Marketplace
npm run build  # First time only
npm run dev

# Terminal 2: Storefront
cd d:\GitHub\TheRxSpot_Marketplace\TheRxSpot_Marketplace-storefront
npm run dev
```

Then open http://localhost:9000/app for admin or http://localhost:8000 for storefront.
