# Documentation System Map

> Visual guide to the progressive disclosure hierarchy

---

## Disclosure Levels

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ LEVEL 0: ORIENTATION                                                        │
│ "Where am I? What can I do?"                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ 00_START_HERE/                                                              │
│ ├── README.md              → "You are here. Pick a task."                   │
│ ├── DECISION_TREE.md       → "Ask me what you're doing"                     │
│ └── QUICKSTART.md          → "Just give me the code"                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ LEVEL 1: CONTEXT                                                            │
│ "What exists? How does it work?"                                            │
│ Read these once to understand the system                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 01_CONTEXT/                                                                 │
│ ├── YOUR_CODEBASE.md       → What exists in this repo                       │
│ ├── MULTI_TENANT_PATTERNS.md → How Medusa marketplaces work                 │
│ └── ARCHITECTURE.md        → Design decisions & why                         │
│                             (498 lines + 492 lines + 261 lines)             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ LEVEL 2: BUILDING                                                           │
│ "How do I implement this?"                                                  │
│ Task-focused guides. Start here for implementation.                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 02_BUILDING/                                                                │
│ ├── MODULES.md             → Create data models                             │
│ ├── WORKFLOWS.md           → Create business processes                      │
│ ├── API_ROUTES.md          → Create HTTP endpoints                          │
│ ├── ADMIN_UI.md            → Customize admin dashboard                      │
│ └── AUTH_SECURITY.md       → Auth & HIPAA compliance                        │
│                             (910 + 830 + 1194 + 741 + 690 lines)            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ LEVEL 3: REFERENCE                                                          │
│ "What's the API? What events exist?"                                        │
│ Look up when needed. Search, don't read.                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 03_REFERENCE/                                                               │
│ ├── ALL_PATTERNS_INDEX.md  → Every pattern, searchable                      │
│ ├── CORE_WORKFLOWS.md      → Built-in Medusa workflows                      │
│ ├── EVENTS_REFERENCE.md    → All events you can subscribe to                │
│ └── TROUBLESHOOTING.md     → Common issues & fixes                          │
│                             (334 + 541 + 520 + 602 lines)                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Usage Paths by Task

### Path A: Adding a New Feature (e.g., "Insurance Verification")

```
LEVEL 0: README.md
    ↓ "I need to build something"
LEVEL 1: YOUR_CODEBASE.md (Business module section)
    ↓ "Business module handles provider data"
Look at: src/modules/business/models/ for similar patterns
    ↓ "How to add a data model"
LEVEL 2: MODULES.md
    ↓ "What DML property type for enum?"
LEVEL 3: ALL_PATTERNS_INDEX.md → Search "model.enum"
    ↓ Implement
```

### Path B: Debugging "Tenant data showing for wrong business"

```
LEVEL 0: README.md
    ↓ "I need to fix a bug"
LEVEL 3: TROUBLESHOOTING.md → "Tenant isolation not working"
    ↓ Check your query includes business_id filter
LEVEL 2: AUTH_SECURITY.md → "Tenant-scoped query pattern"
    ↓ Fix
```

### Path C: Creating a Consultation Workflow

```
LEVEL 0: DECISION_TREE.md
    ↓ "Building a business process/automation"
LEVEL 1: YOUR_CODEBASE.md (Workflows section)
    ↓ See existing: consult-gating, order-lifecycle
Look at: src/workflows/consult-gating/
    ↓ "How to build a workflow"
LEVEL 2: WORKFLOWS.md
    ↓ "What built-in steps can I use?"
LEVEL 3: CORE_WORKFLOWS.md → useQueryGraphStep
    ↓ Implement
```

### Path D: New Admin Dashboard Page

```
LEVEL 0: QUICKSTART.md
    ↓ Not in quickstart patterns
LEVEL 1: YOUR_CODEBASE.md (check if admin customizations exist)
    ↓ Minimal admin UI in this codebase
LEVEL 2: ADMIN_UI.md
    ↓ "When to build separate admin"
DECISION: Use Medusa Admin widgets OR build separate dashboard
    ↓ Implement
```

---

## File Size Distribution

| Level | Files | Total Lines | Purpose |
|-------|-------|-------------|---------|
| 0 - Start | 3 | 598 | Entry points |
| 1 - Context | 3 | 1,251 | Understanding |
| 2 - Building | 5 | 4,365 | Implementation |
| 3 - Reference | 4 | 1,997 | Lookup |
| **Total** | **15** | **~8,200** | **(vs 125,000 original)** |

---

## Progressive Disclosure Rules

### ✅ DO
- Start at Level 0, go deeper only when needed
- Use DECISION_TREE.md for guided navigation
- Search ALL_PATTERNS_INDEX.md for specific APIs
- Read YOUR_CODEBASE.md once to understand what exists

### ❌ DON'T
- Read everything sequentially
- Jump to Reference without understanding Context
- Skip Level 2 (Building) and try to implement from Reference
- Copy from old trimmed_part*.md files (they're deleted)

---

## Content Relationships

```
YOUR_CODEBASE.md
    ├── References actual code in src/
    ├── Links to: MULTI_TENANT_PATTERNS.md (for pattern context)
    └── Used by: All BUILDING/*.md (to show what exists)

MULTI_TENANT_PATTERNS.md
    ├── Explains Medusa marketplace patterns
    ├── Contrasts with YOUR_CODEBASE.md implementation
    └── Used by: ARCHITECTURE.md (for design decisions)

BUILDING/*.md
    ├── MODULES.md references actual models in src/modules/
    ├── WORKFLOWS.md references actual workflows in src/workflows/
    ├── API_ROUTES.md references actual routes in src/api/
    └── All link to REFERENCE/*.md for detailed APIs

REFERENCE/*.md
    ├── ALL_PATTERNS_INDEX.md aggregates patterns from all BUILDING/*.md
    ├── CORE_WORKFLOWS.md documents @medusajs/medusa/core-flows
    ├── EVENTS_REFERENCE.md documents all possible events
    └── TROUBLESHOOTING.md aggregates common issues from all levels
```

---

## Search Strategy

| If you're looking for... | Search in... |
|--------------------------|--------------|
| What exists in codebase | YOUR_CODEBASE.md |
| How to do X | DECISION_TREE.md or QUICKSTART.md |
| Specific code pattern | ALL_PATTERNS_INDEX.md |
| Workflow step reference | CORE_WORKFLOWS.md |
| Event to subscribe to | EVENTS_REFERENCE.md |
| Error fix | TROUBLESHOOTING.md |
| Multi-tenant patterns | MULTI_TENANT_PATTERNS.md |
| Why we built it this way | ARCHITECTURE.md |

---

## Maintenance Notes

When adding new features to the codebase:

1. **Update YOUR_CODEBASE.md** - Add new module/workflow/route descriptions
2. **Update relevant BUILDING/*.md** - Add new patterns if they differ from existing
3. **Update ALL_PATTERNS_INDEX.md** - Add new patterns to the index
4. **Update EVENTS_REFERENCE.md** - Add new custom events

When upgrading Medusa versions:

1. **Update CORE_WORKFLOWS.md** - New/changed workflows
2. **Update EVENTS_REFERENCE.md** - New/changed events
3. **Update TROUBLESHOOTING.md** - New version-specific issues
4. **Review BUILDING/*.md** - API changes in DML, workflows, etc.

---

*This system follows progressive disclosure: Start shallow, go deep only when needed.*
