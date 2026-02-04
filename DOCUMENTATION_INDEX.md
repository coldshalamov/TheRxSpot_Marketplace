# Documentation Index - TheRxSpot Marketplace

**Quick reference guide to all project documentation**

---

## 🚀 Getting Started

1. **[README.md](README.md)** - Project overview, quick start guide
2. **[IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)** - Step-by-step build roadmap

---

## 📚 Core Documentation

### High-Level
- **[README.md](README.md)** - Project vision, tech stack, quick start
- **[FEATURES.md](docs/FEATURES.md)** - Detailed feature specifications based on partner dashboard
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture, data models, API design

### Technical
- **[API_REFERENCE.md](docs/API_REFERENCE.md)** - REST API endpoints and schemas
- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Production deployment guide
- **[TESTING_SUMMARY.md](docs/TESTING_SUMMARY.md)** - Test strategy and coverage

---

## 📁 Code Documentation

### Backend (`src/`)

| Path | Description |
|------|-------------|
| `src/modules/` | Custom business logic modules |
| `src/api/` | REST API routes (admin & store) |
| `src/workflows/` | Business process workflows |
| `src/jobs/` | Background job definitions |
| `src/subscribers/` | Event handlers |
| `src/admin/routes/` | Admin dashboard UI pages |

**Module READMEs:**
- [src/modules/README.md](src/modules/README.md)
- [src/api/README.md](src/api/README.md)
- [src/workflows/README.md](src/workflows/README.md)
- [src/jobs/README.md](src/jobs/README.md)
- [src/subscribers/README.md](src/subscribers/README.md)
- [src/scripts/README.md](src/scripts/README.md)

### Frontend
- **TheRxSpot_Marketplace-storefront/** - Next.js customer-facing site

---

## 🎯 By Use Case

### I Want To...

#### Understand the Project
→ Start with [README.md](README.md)
→ Read [FEATURES.md](docs/FEATURES.md) to see what we're building
→ Review [ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design

#### Start Development
→ Follow [README.md](README.md) Quick Start section
→ Reference [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for roadmap
→ Use [API_REFERENCE.md](docs/API_REFERENCE.md) for API details

#### Deploy to Production
→ Follow [DEPLOYMENT.md](docs/DEPLOYMENT.md)
→ Check [TESTING_SUMMARY.md](docs/TESTING_SUMMARY.md) for test requirements

#### Add a New Feature
1. Design: Review [ARCHITECTURE.md](docs/ARCHITECTURE.md) for patterns
2. Implement: Follow existing module structure in `src/modules/`
3. Test: Add tests following [TESTING_SUMMARY.md](docs/TESTING_SUMMARY.md)
4. Document: Update [FEATURES.md](docs/FEATURES.md) and API docs

#### Understand API Endpoints
→ [API_REFERENCE.md](docs/API_REFERENCE.md) - Complete API documentation

---

## 📊 Document Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| README.md | ✅ Current | 2026-02-03 |
| IMPLEMENTATION_PLAN.md | ✅ Current | 2026-02-03 |
| FEATURES.md | ✅ Current | 2026-02-03 |
| ARCHITECTURE.md | ✅ Current | 2026-02-03 |
| API_REFERENCE.md | ✅ Current | (pre-existing) |
| DEPLOYMENT.md | ✅ Current | (pre-existing) |
| TESTING_SUMMARY.md | ✅ Current | (pre-existing) |

---

## 🗂️ Archived Documentation

**Location:** `docs/archive/`

Contains historical planning documents from initial project setup:
- Agent coordination plans
- Damage assessments
- Inventory reports

**Purpose:** Reference only, not needed for current development.

---

## 📝 Documentation Standards

### When to Update

**ALWAYS update docs when:**
- Adding new API endpoints → Update API_REFERENCE.md
- Adding new features → Update FEATURES.md
- Changing architecture → Update ARCHITECTURE.md
- Changing deployment process → Update DEPLOYMENT.md

### How to Document

**API Endpoints:**
```markdown
### POST /admin/endpoint
**Description:** What it does
**Auth:** Required
**Request Body:**
\`\`\`json
{ "field": "value" }
\`\`\`
**Response:**
\`\`\`json
{ "result": "value" }
\`\`\`
```

**Features:**
```markdown
### Feature Name
**Description:** What it does
**User Flow:** Step-by-step
**Implementation:** Which files/modules
**Status:** ✅ Complete | 🟡 Partial | ⏳ Pending
```

---

## 🔗 External Resources

- **Medusa Docs:** https://docs.medusajs.com
- **Next.js Docs:** https://nextjs.org/docs
- **Stripe API:** https://stripe.com/docs/api

---

## 📞 Need Help?

1. **Check docs first** - Most answers are here
2. **Search code** - Look for similar implementations
3. **Ask the team** - If stuck, reach out

---

**Last Updated:** 2026-02-03
