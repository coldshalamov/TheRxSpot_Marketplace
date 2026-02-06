# Medusa V2 Documentation - Progressive Disclosure System

> **Navigation Rule**: Start at your task level, drill down only when needed. Don't read everything.

---

## 🎯 "I need to..." - Pick Your Starting Point

| If you need to... | Go To | Estimated Read Time |
|-------------------|-------|---------------------|
| **Understand this codebase** | [../01_CONTEXT/YOUR_CODEBASE.md](../01_CONTEXT/YOUR_CODEBASE.md) | 5 min |
| **Understand multi-tenant patterns** | [../01_CONTEXT/MULTI_TENANT_PATTERNS.md](../01_CONTEXT/MULTI_TENANT_PATTERNS.md) | 5 min |
| **Create a new module** | [../02_BUILDING/MODULES.md](../02_BUILDING/MODULES.md) | 10 min |
| **Create a new workflow** | [../02_BUILDING/WORKFLOWS.md](../02_BUILDING/WORKFLOWS.md) | 10 min |
| **Create a new API route** | [../02_BUILDING/API_ROUTES.md](../02_BUILDING/API_ROUTES.md) | 8 min |
| **Customize the admin UI** | [../02_BUILDING/ADMIN_UI.md](../02_BUILDING/ADMIN_UI.md) | 8 min |
| **Fix a bug / debug** | [../03_REFERENCE/TROUBLESHOOTING.md](../03_REFERENCE/TROUBLESHOOTING.md) | 3 min |
| **Find a specific pattern** | [../03_REFERENCE/ALL_PATTERNS_INDEX.md](../03_REFERENCE/ALL_PATTERNS_INDEX.md) | Search |

---

## 📚 Hierarchy Levels

This documentation is organized in **4 disclosure levels**. Each level adds detail. Stop when you have what you need.

```
Level 0: This README (you are here)
    ↓ Pick a task
Level 1: Context files - What exists, how it works
    ↓ Pick a component type
Level 2: Building guides - How to build/modify
    ↓ Need implementation details?
Level 3: Reference - Deep docs, edge cases, API
```

---

## 🗺️ Directory Map

```
medusadocs/
├── 00_START_HERE/
│   ├── README.md              ← You are here
│   ├── DECISION_TREE.md       ← "Ask me what you're doing, I'll tell you where to go"
│   └── QUICKSTART.md          ← "Just give me the code"
│
├── 01_CONTEXT/                ← UNDERSTANDING (Read Once)
│   ├── YOUR_CODEBASE.md       ← What's in this repo
│   ├── MULTI_TENANT_PATTERNS.md ← How Medusa marketplaces work
│   └── ARCHITECTURE.md        ← How YOUR system is designed
│
├── 02_BUILDING/               ← IMPLEMENTATION (Task-focused)
│   ├── MODULES.md             ← Create/modify modules
│   ├── WORKFLOWS.md           ← Create/modify workflows
│   ├── API_ROUTES.md          ← Create/modify API routes
│   ├── ADMIN_UI.md            ← Admin customizations
│   └── AUTH_SECURITY.md       ← Auth patterns, guards, HIPAA
│
└── 03_REFERENCE/              ← LOOKUP (Search when needed)
    ├── ALL_PATTERNS_INDEX.md  ← Every pattern, searchable
    ├── CORE_WORKFLOWS.md      ← Built-in Medusa workflows
    ├── EVENTS_REFERENCE.md    ← All events you can subscribe to
    └── TROUBLESHOOTING.md     ← Common issues
```

---

## 🚨 Important: This is NOT the Full Medusa Docs

This is a **curated subset** (85% smaller) containing only:
- Patterns used in YOUR codebase
- Multi-tenant marketplace patterns
- Medusa V2.13.1 APIs

**If you can't find something**: The pattern might not exist here, or might be in the original `llms-full.txt` (16MB - ask for it if needed).

---

## 🏥 Domain Context: Healthcare Multi-Tenant Marketplace

This codebase is **TheRxSpot** - a telehealth platform where:
- **Business** = Pharmacy or clinic (tenant)
- **BusinessUser** = Staff/admin for that business
- **Clinician** = Healthcare provider with schedules
- **Consultation** = Telehealth visit between patient and clinician
- **Patient** = Customer receiving care
- **ConsultSubmission** = Encrypted intake forms

**Security Requirements**:
- PHI encryption at rest
- Audit logging for all data access
- Tenant isolation (no cross-business data leaks)
- Auto-logoff for inactive sessions

---

## 📊 Stats

| Metric | Original | This System | Reduction |
|--------|----------|-------------|-----------|
| Total Lines | 125,309 | ~20,000 | 84% |
| Files | 1 | Organized hierarchy | - |
| Read Time (full) | 8+ hours | 30 min for typical task | 94% |

---

## 💡 Pro Tips for AI Agents

1. **Start shallow**: Most tasks need only Level 2 (BUILDING) files
2. **Don't read sequentially**: Use the Decision Tree or Index
3. **Cross-reference**: YOUR_CODEBASE.md shows what EXISTS, building guides show how to ADD
4. **Pattern matching**: If stuck, look at existing similar code in `src/`, then check ALL_PATTERNS_INDEX.md

---

**Ready?** Pick a task from the table above, or read [DECISION_TREE.md](./DECISION_TREE.md) for guided navigation.
