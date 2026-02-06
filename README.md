# TheRxSpot Marketplace

**Telehealth Commerce + Operations Platform**

> **The System of Record for Multi-Tenant Telehealth**
> Replacing the legacy operational engine (VSDH) to provide a reliable, white-label commerce and fulfillment backbone.

---

## 🎯 The New Mandate

We are transitioning from a simple "Go-To-Market" layer to becoming the **Telehealth Engine** itself.

**Our Goal:** Replace the brittle upstream provider (VSDH) with a robust, owned platform that controls the entire operational lifecycle:
1.  **System of Record:** We own the order book, tenant configurations, and state.
2.  **Operational Integrity:** No lost orders, full auditability, reliable state management.
3.  **Delegated Clinical Actions:** We facilitate the workflow but delegate the specific clinical act to licensed providers. We do **not** provide medical services directly; we provide the *platform* for them.

### What We Built vs. What We Delegate

| We Own (The Rx Spot) | We Delegate (Partners/Provider Layer) |
| :--- | :--- |
| ✅ **Tenant Management:** Provisioning, config, branding | ❌ **Clinical Consultations:** Licensed MDs/DOs |
| ✅ **Order Lifecycle:** System of record for all orders | ❌ **Pharmacy Fulfillment:** Physical dispensing |
| ✅ **Storefronts:** White-label operational sites | ❌ **Video Infrastructure:** 3rd party tools |
| ✅ **Financials:** Payouts, commissions, fees | |

---

## 🌍 The Ecosystem

To understand how this repository fits into the broader business, we operate with three distinct components:

### 1. The Platform (This Repository)
**The Engine.**
- **Role:** Central Backoffice, API, and Multi-Tenant Storefront host.
- **Responsibility:** Manages all data, orders, users, and logic.
- **Tech:** Medusa.js (Backend), Next.js (Admin + Storefront), PostgreSQL, Redis.

### 2. The Front Site (Separate Repository)
**The Business Face.**
- **Role:** Marketing and Sales for The Rx Spot itself.
- **Responsibility:** Explaining our value prop to potential B2B partners/tenants.
- **Relation:** Feeds leads into the Platform; does not process patients.

### 3. Website Templates (External Asset Library)
**The Look & Feel.**
- **Role:** A collection of high-quality designs for tenant storefronts.
- **Responsibility:** Provides the visual identity (HTML/CSS/Config) that the Platform consumes to generate unique, white-labeled sites for each partner.
- **Mechanism:** The Platform loads these templates/configs to dynamically brand the customer experience based on the active Tenant.

---

## 📁 Repository Structure

```
TheRxSpot_Marketplace/
├── src/                              # Medusa Backend (The Engine)
│   ├── modules/                      # Custom business logic (Business, Consults, Financials)
│   ├── api/                          # REST API routes
│   └── admin/routes/                 # Operational Dashboard (Backoffice)
├── TheRxSpot_Marketplace-storefront/ # Multi-Tenant Customer App
│   └── src/app/[countryCode]/(tenant)/ # Dynamic Template Renderer
├── docs/                             # Documentation
│   ├── ARCHITECTURE.md               # System design & Ecosystem map
│   ├── IMPLEMENTATION_PLAN.md        # Build roadmap
│   └── FEATURES.md                   # Spec details
└── README.md                         # This file
```

---

## 🚀 Key capabilities

### 1. Operations Engine
- **Tenant Provisioning:** Rapid onboarding of new partners (influencers, clinics).
- **Order Book:** Canonical source of truth for every order's status and history.
- **Commission System:** Automated tracking of platform fees vs. tenant revenue.

### 2. Clinical Workflow Support
- **Consult-Gating:** Products can be locked behind a "Consult Required" flag.
- **Intake Flow:** Digital forms and scheduling for patient data collection.
- **Provider Routing:** Orders move to a "Ready for Review" state for external clinicians.

### 3. Reliability & Compliance
- **Audit Logging:** Every action (especially PHI access) is logged immutably.
- **Tenant Isolation:** Strict data scoping ensuring Partner A cannot see Partner B's data.
- **Resiliency:** Designed to survive unreliable external partners by holding state locally.

---

## 🛠️ Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis

### Backend Setup
```bash
npm install
cp .env.template .env
npm run build
npm run dev
# Backend runs on http://localhost:9001
```

### Storefront Setup
```bash
cd TheRxSpot_Marketplace-storefront
npm install
cp .env.local.template .env.local
npm run dev
# Storefront runs on http://localhost:8000
```

---

## 📚 Documentation
- **[Architecture & Ecosystem](docs/ARCHITECTURE.md)** - Detailed system map.
- **[Implementation Plan](docs/IMPLEMENTATION_PLAN.md)** - Status and roadmap.
- **[Feature Specs](docs/FEATURES.md)** - Detailed behavior definitions.

---

## 📝 License
Proprietary - TheRxSpot Internal Use Only
