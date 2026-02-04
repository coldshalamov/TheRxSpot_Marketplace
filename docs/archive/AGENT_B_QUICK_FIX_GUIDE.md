# AGENT B - QUICK FIX GUIDE
## Emergency Repair Instructions

**If you're stuck, start here.**

---

## 🔴 EMERGENCY: Fix Triplicate Code (5 minutes)

### Problem
Files have the same code repeated 3 times, causing build failures.

### Quick Fix Script

```bash
# Navigate to project
cd D:\GitHub\TheRxSpot_Marketplace

# Fix consultations page
head -n 111 tenant-admin/src/app/dashboard/consultations/page.tsx > temp.tsx
mv temp.tsx tenant-admin/src/app/dashboard/consultations/page.tsx

# Fix earnings page  
head -n 185 tenant-admin/src/app/dashboard/earnings/page.tsx > temp.tsx
mv temp.tsx tenant-admin/src/app/dashboard/earnings/page.tsx

# Verify
cd tenant-admin
npm run build
```

### Manual Fix (if script doesn't work)

**For consultations/page.tsx:**
1. Open the file
2. Find line 113 (starts the second copy)
3. Delete from line 113 to end of file
4. Save
5. Verify build passes

**For earnings/page.tsx:**
1. Open the file
2. Find line 187 (starts the second copy)
3. Delete from line 187 to end of file
4. Save
5. Verify build passes

---

## 🔴 CRITICAL: Fix Duplicate API Functions

### Problem
`lib/api.ts` has all functions defined twice.

### Quick Fix

```bash
cd D:\GitHub\TheRxSpot_Marketplace\tenant-admin

# Keep only first 167 lines
head -n 167 src/lib/api.ts > temp.ts
mv temp.ts src/lib/api.ts
```

---

## 🟡 IMPORTANT: Fix SDK Configuration

### File
`TheRxSpot_Marketplace-storefront/src/lib/config.ts`

### Add This Line
```typescript
export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: process.env.NODE_ENV === "development",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
  auth: { type: "session" }  // <-- ADD THIS
})
```

---

## 🟡 IMPORTANT: Enable Strict Mode

### File
`TheRxSpot_Marketplace-storefront/next.config.js`

### Change These Lines
```javascript
module.exports = {
  // ... other config
  eslint: { 
    ignoreDuringBuilds: false  // Change from true
  },
  typescript: { 
    ignoreBuildErrors: false    // Change from true
  },
}
```

Do the same for `tenant-admin/next.config.js`

---

## ✅ VERIFICATION CHECKLIST

After each fix, run:

```bash
# Test storefront
cd TheRxSpot_Marketplace-storefront
yarn type-check
yarn build

# Test tenant-admin
cd ../tenant-admin
npm run type-check
npm run build
```

**All must pass before proceeding!**

---

## 🚀 GETTING BACK ON TRACK

### If you've made a mess:

1. **Stop** - Don't add more code
2. **Fix duplicates** - Use instructions above
3. **Verify build** - Must pass before continuing
4. **Continue with PLAN_AGENT_B_UPDATED.md**

### If you need help from Agent A:

Create a request file:
```bash
cd D:\GitHub\TheRxSpot_Marketplace

# Create request
cat > .agent-b-requests/request-help-$(date +%s).md << 'EOF'
# Request from Agent B to Agent A
**Priority:** P0
**Date:** $(date +%Y-%m-%d)

## Problem
Describe what's not working

## What I Need
Describe what you need from Agent A

## Urgency
Why is this blocking you?
EOF
```

---

## 📞 EMERGENCY CONTACT PROTOCOL

**If completely stuck:**

1. Document what you've tried
2. Create detailed error report
3. Ask for specific help
4. Continue with other tasks while waiting

**Don't:**
- Delete files without backing up
- Comment out code to "fix" errors
- Add @ts-ignore without understanding why
- Skip verification steps

---

## ⏱️ TIME ESTIMATES

| Fix | Time |
|-----|------|
| Remove triplicates | 5 min |
| Fix API duplicates | 5 min |
| SDK config | 2 min |
| Enable strict mode | 2 min |
| Verify builds | 5 min |
| **Total Emergency Fix** | **~20 min** |

---

**Fix these first, then proceed with the main plan.**
