# Decision Tree - Find Your Documentation Path

> Answer the questions. Follow the path. Stop when you have what you need.

---

## Question 1: What is your goal?

### A. "I need to understand the existing system"
→ Read [../01_CONTEXT/YOUR_CODEBASE.md](../01_CONTEXT/YOUR_CODEBASE.md)
   - What modules exist
   - How they relate
   - Key patterns used

### B. "I need to build something new"
→ Go to **Question 2**

### C. "I need to fix a bug or debug"
→ Read [../03_REFERENCE/TROUBLESHOOTING.md](../03_REFERENCE/TROUBLESHOOTING.md)

### D. "I need to see what's possible"
→ Read [../01_CONTEXT/MULTI_TENANT_PATTERNS.md](../01_CONTEXT/MULTI_TENANT_PATTERNS.md)

---

## Question 2: What are you building?

### A. "A new data model/entity" (e.g., new type of record to store)
→ Read [../02_BUILDING/MODULES.md](../02_BUILDING/MODULES.md)
   
**Examples:**
- New entity type (e.g., "InsurancePlan", "Prescription")
- Adding fields to existing entity
- New relationships between entities

**Also check:**
- Look at existing similar models in `src/modules/*/models/`
- See CODEBASE_SUMMARY.md section on your target module

### B. "A new business process/automation" (e.g., when X happens, do Y)
→ Read [../02_BUILDING/WORKFLOWS.md](../02_BUILDING/WORKFLOWS.md)

**Examples:**
- When consultation is completed, create order
- When order is placed, calculate earnings
- Background job that runs periodically
- Multi-step process with rollback on failure

**Also check:**
- Look at existing workflows in `src/workflows/`
- Look at subscribers in `src/subscribers/`
- Look at jobs in `src/jobs/`

### C. "A new API endpoint" (e.g., new HTTP route)
→ Read [../02_BUILDING/API_ROUTES.md](../02_BUILDING/API_ROUTES.md)

**Examples:**
- New admin endpoint for dashboard data
- New store endpoint for patient-facing feature
- New webhook handler

**Also check:**
- Look at existing routes in `src/api/admin/` or `src/api/store/`
- Check if similar route exists that you can copy

### D. "Admin dashboard changes" (UI, new pages, widgets)
→ Read [../02_BUILDING/ADMIN_UI.md](../02_BUILDING/ADMIN_UI.md)

**Examples:**
- New admin page for reporting
- Widget on existing page
- Custom data table
- Dashboard charts

**Also check:**
- This codebase has minimal admin customizations (mostly uses Medusa default)
- Check `src/admin/` if it exists

### E. "Authentication or security changes"
→ Read [../02_BUILDING/AUTH_SECURITY.md](../02_BUILDING/AUTH_SECURITY.md)

**Examples:**
- New user type
- New auth method
- Changing permission rules
- HIPAA compliance changes

---

## Question 3: Implementation detail needed?

After reading the Level 2 (BUILDING) guide:

### A. "I understand the pattern, but need specific API details"
→ Check [../03_REFERENCE/ALL_PATTERNS_INDEX.md](../03_REFERENCE/ALL_PATTERNS_INDEX.md)

### B. "I need to see what built-in Medusa workflows exist"
→ Check [../03_REFERENCE/CORE_WORKFLOWS.md](../03_REFERENCE/CORE_WORKFLOWS.md)

### C. "I need to know what events I can subscribe to"
→ Check [../03_REFERENCE/EVENTS_REFERENCE.md](../03_REFERENCE/EVENTS_REFERENCE.md)

### D. "I'm getting an error / something's not working"
→ Check [../03_REFERENCE/TROUBLESHOOTING.md](../03_REFERENCE/TROUBLESHOOTING.md)

---

## Quick Reference: Common Tasks

### Add a new Business-scoped entity
```
YOUR_CODEBASE.md (see Business module)
  → MODULES.md (how to create module/data model)
  → Look at src/modules/business/models/*.ts for examples
  → ALL_PATTERNS_INDEX.md (search "belongsTo", "business_id")
```

### Create a consultation workflow
```
YOUR_CODEBASE.md (see Consultation workflows)
  → WORKFLOWS.md (how to create workflow)
  → Look at src/workflows/consult-gating/
  → CORE_WORKFLOWS.md (useQueryGraphStep, etc.)
```

### Add admin endpoint for earnings report
```
YOUR_CODEBASE.md (see Financials module)
  → API_ROUTES.md (how to create route)
  → Look at src/api/admin/earnings/
  → ALL_PATTERNS_INDEX.md (search "AuthenticatedMedusaRequest")
```

### Add audit logging to new feature
```
YOUR_CODEBASE.md (see Compliance module)
  → Look at src/api/middlewares/audit-logging.ts
  → Look at src/subscribers/ for audit event handlers
  → AUTH_SECURITY.md (HIPAA section)
```

---

## Anti-Patterns (Don't Do This)

❌ **Don't** read everything sequentially
❌ **Don't** jump to REFERENCE without understanding CONTEXT
❌ **Don't** copy from trimmed_part*.md files directly (they're source material, reorganized into BUILDING guides)
❌ **Don't** assume patterns from llms-full.txt work here (we've curated for V2.13.1 + your modules)

---

## Golden Path for New Feature

The most common path for adding a feature:

1. **Understand**: Read YOUR_CODEBASE.md section on relevant module
2. **Pattern**: Look at existing similar code in `src/`
3. **Build**: Read the relevant BUILDING/*.md guide
4. **Reference**: Check ALL_PATTERNS_INDEX.md for specific APIs

**Example**: Adding "Insurance Verification" feature
1. Read YOUR_CODEBASE.md → Business module handles provider data
2. Look at src/modules/business/models/ → See Business, Location patterns
3. Read MODULES.md → How to add data model
4. Check ALL_PATTERNS_INDEX.md → Search "model.enum", "model.text()"

---

**Still not sure?** Read [QUICKSTART.md](./QUICKSTART.md) for the 5 most common copy-paste patterns.
