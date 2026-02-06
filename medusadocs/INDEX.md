# Medusa V2 Documentation - Progressive Disclosure System

> **Navigation Rule**: Start at your task level, drill down only when needed.

---

## 🚀 Quick Start (Pick One)

| I need to... | Go To | Time |
|--------------|-------|------|
| **Understand the codebase** | [01_CONTEXT/YOUR_CODEBASE.md](01_CONTEXT/YOUR_CODEBASE.md) | 5 min |
| **Build something new** | [00_START_HERE/DECISION_TREE.md](00_START_HERE/DECISION_TREE.md) | 2 min |
| **Copy-paste a pattern** | [00_START_HERE/QUICKSTART.md](00_START_HERE/QUICKSTART.md) | 3 min |
| **Fix a bug** | [03_REFERENCE/TROUBLESHOOTING.md](03_REFERENCE/TROUBLESHOOTING.md) | 2 min |
| **Find a specific pattern** | [03_REFERENCE/ALL_PATTERNS_INDEX.md](03_REFERENCE/ALL_PATTERNS_INDEX.md) | Search |

---

## 📁 Directory Structure

```
medusadocs/
├── 00_START_HERE/           ← ENTRY POINTS
│   ├── README.md            → Overview of the system
│   ├── DECISION_TREE.md     → "What are you doing? I'll tell you where to go"
│   └── QUICKSTART.md        → Copy-paste patterns for 5 common tasks
│
├── 01_CONTEXT/              ← UNDERSTANDING (Read Once)
│   ├── YOUR_CODEBASE.md     → What exists in this repo
│   ├── MULTI_TENANT_PATTERNS.md → How Medusa marketplaces work
│   └── ARCHITECTURE.md      → Design decisions & why
│
├── 02_BUILDING/             ← IMPLEMENTATION (Task-Focused)
│   ├── MODULES.md           → Create/modify data models
│   ├── WORKFLOWS.md         → Create business processes
│   ├── API_ROUTES.md        → Create HTTP endpoints
│   ├── ADMIN_UI.md          → Customize admin dashboard
│   └── AUTH_SECURITY.md     → Auth patterns & HIPAA compliance
│
└── 03_REFERENCE/            ← LOOKUP (Search When Needed)
    ├── ALL_PATTERNS_INDEX.md → Every pattern, searchable
    ├── CORE_WORKFLOWS.md    → Built-in Medusa workflows
    ├── EVENTS_REFERENCE.md  → All events you can subscribe to
    └── TROUBLESHOOTING.md   → Common issues & fixes
```

---

## 📊 Progressive Disclosure Levels

This documentation is organized in **4 disclosure levels**. Each level adds detail. **Stop when you have what you need.**

```
Level 0: Start Here (this page)
    ↓ Pick a task
Level 1: Context - What exists, how it works
    ↓ Pick a component type
Level 2: Building - How to build/modify
    ↓ Need implementation details?
Level 3: Reference - Deep docs, edge cases
```

---

## 🎯 By Task Type

### Building a New Feature

1. **Understand context**: [01_CONTEXT/YOUR_CODEBASE.md](01_CONTEXT/YOUR_CODEBASE.md) (relevant module section)
2. **Look at existing code**: Find similar feature in `src/`
3. **Read building guide**: Pick from [02_BUILDING/](02_BUILDING/)
4. **Check reference**: [03_REFERENCE/ALL_PATTERNS_INDEX.md](03_REFERENCE/ALL_PATTERNS_INDEX.md) for specific APIs

### Debugging an Issue

1. **Check troubleshooting**: [03_REFERENCE/TROUBLESHOOTING.md](03_REFERENCE/TROUBLESHOOTING.md)
2. **Search patterns index**: [03_REFERENCE/ALL_PATTERNS_INDEX.md](03_REFERENCE/ALL_PATTERNS_INDEX.md)
3. **Review architecture**: [01_CONTEXT/ARCHITECTURE.md](01_CONTEXT/ARCHITECTURE.md) (for design decisions)

### Understanding Multi-Tenancy

1. **Read patterns**: [01_CONTEXT/MULTI_TENANT_PATTERNS.md](01_CONTEXT/MULTI_TENANT_PATTERNS.md)
2. **See our implementation**: [01_CONTEXT/YOUR_CODEBASE.md](01_CONTEXT/YOUR_CODEBASE.md) (Business module)
3. **Architecture decisions**: [01_CONTEXT/ARCHITECTURE.md](01_CONTEXT/ARCHITECTURE.md)

### Adding Security/Compliance

1. **Security guide**: [02_BUILDING/AUTH_SECURITY.md](02_BUILDING/AUTH_SECURITY.md)
2. **Check existing middleware**: `src/api/middlewares/`
3. **HIPAA patterns**: [02_BUILDING/AUTH_SECURITY.md](02_BUILDING/AUTH_SECURITY.md) (PHI section)

---

## 📈 Stats

| Metric | Original | This System | Reduction |
|--------|----------|-------------|-----------|
| Total Lines | 125,309 | ~25,000 | 80% |
| Read Time (full) | 8+ hours | 30 min typical task | 94% |
| Files | 1 giant file | Organized hierarchy | - |

---

## 🏥 Domain: Healthcare Multi-Tenant Marketplace

This is **TheRxSpot** - a telehealth platform where:

- **Business** = Pharmacy/clinic (tenant)
- **Clinician** = Healthcare provider  
- **Consultation** = Telehealth visit
- **Patient** = Customer receiving care
- **ConsultSubmission** = Encrypted intake forms

**Security**: HIPAA-compliant with PHI encryption, audit logging, tenant isolation.

---

## 💡 Pro Tips

1. **Don't read sequentially** - Use the Decision Tree
2. **Start with context** - Know what exists before adding
3. **Copy existing patterns** - Look at `src/` for similar implementations
4. **Check references last** - Deep details when needed

---

## 🆘 Getting Help

**Pattern not found?** Check [03_REFERENCE/ALL_PATTERNS_INDEX.md](03_REFERENCE/ALL_PATTERNS_INDEX.md)

**Still stuck?** The original full docs are in `../llms-full.txt` (16MB)

**Code questions?** Look at existing implementations in `src/` first

---

*Generated: 2026-02-06*  
*Medusa Version: 2.13.1*  
*System: Progressive Disclosure Documentation*
