# TheRxSpot Marketplace

**White-Label Telehealth Platform** - Replace partner with our own multi-tenant marketplace

---

## 🎯 Project Vision

Build a **white-label telehealth platform** to replace our partner's service. We'll own the tech stack and provide:

1. **Admin Dashboard** - Manage tenants, orders, consultations, earnings
2. **Customer Storefronts** - Personalized per business (domain-based routing)
3. **Product Catalog** - Medications with consult-gating
4. **Order Management** - Track orders through fulfillment
5. **Commission System** - Track earnings and process payouts

**What We DON'T Handle** (Partner/Offsite):
- ❌ Doctor consultations (offsite providers)
- ❌ Prescription fulfillment (pharmacy partner)
- ❌ Video call infrastructure (third-party)

---

## 📁 Repository Structure

```
TheRxSpot_Marketplace/
├── src/                              # Medusa Backend
│   ├── modules/                      # Custom business logic
│   │   ├── business/                 # Multi-tenant management
│   │   ├── consultation/             # Consultation tracking
│   │   ├── financials/               # Earnings & payouts
│   │   └── compliance/               # Documents & audit logs
│   ├── api/                          # REST API routes
│   ├── workflows/                    # Business process flows
│   ├── jobs/                         # Background tasks
│   └── admin/routes/                 # Admin UI pages
├── TheRxSpot_Marketplace-storefront/ # Next.js Customer Site
├── docs/                             # Documentation
│   ├── IMPLEMENTATION_PLAN.md        # Step-by-step build plan
│   ├── FEATURES.md                   # Feature specifications
│   ├── ARCHITECTURE.md               # System architecture
│   └── API_REFERENCE.md              # API documentation
└── README.md                         # This file
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis (for rate limiting)

### Backend Setup
```bash
# Install dependencies
npm install

# Configure environment
cp .env.template .env
# Edit .env with your database credentials

# Run migrations
npm run build

# Start development server
npm run dev
```

Backend runs on `http://localhost:9000`

### Storefront Setup
```bash
cd TheRxSpot_Marketplace-storefront
npm install
cp .env.local.template .env.local
# Edit .env.local with backend URL
npm run dev
```

Storefront runs on `http://localhost:8000`

---

## 📋 Key Features

### Multi-Tenant Management
- Create businesses with custom domains
- Brand customization (logo, colors, tagline)
- Location-based serviceable states
- Per-tenant product catalogs

### User Management
- Client accounts with roles
- Phone verification
- Status tracking (Active/Inactive)

### Consultation Tracking
- Link consultations to orders
- Track status (Scheduled, Completed, etc.)
- Support multiple modes (Video, Audio, Form)
- Clinician assignment

### Order Management
- Shopping cart with consult-gating
- Order status tracking
- Product types (Initial, Refill)
- Delivery status

### Earnings & Payouts
- Commission tracking per order
- Platform fee calculation
- Payout requests
- Balance management

### Coupons & Discounts
- Fixed amount discounts
- Active/Inactive status
- Usage tracking

---

## 🔧 Implementation Status

**Current Phase:** Foundation Complete ✅

| Component | Status | Next Steps |
|-----------|--------|------------|
| Backend API | ✅ Complete | Deploy to staging |
| Admin Dashboard | 🟡 Partial | Build remaining pages |
| Storefront | 🟡 Template | Customize for tenants |
| Payment Integration | ⏳ Pending | Integrate Stripe |
| Custom Domains | ⏳ Pending | DNS automation |

See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for detailed roadmap.

---

## 📚 Documentation

- **[Implementation Plan](docs/IMPLEMENTATION_PLAN.md)** - Step-by-step build plan
- **[Features](docs/FEATURES.md)** - Feature specifications
- **[Architecture](docs/ARCHITECTURE.md)** - System design & data models
- **[API Reference](docs/API_REFERENCE.md)** - REST API documentation
- **[Deployment](docs/DEPLOYMENT.md)** - Production deployment guide

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:consultation
npm run test:earnings
npm run test:documents
```

7 integration tests covering:
- Consultation lifecycle
- Consult-gating workflow
- Earnings calculation
- Document security
- Audit logging
- Rate limiting
- Order workflow

---

## 🔒 Security & Compliance

### Built-in Security Features
- ✅ Redis-based rate limiting
- ✅ Virus scanning on file uploads (ClamAV)
- ✅ MIME type validation
- ✅ Auto-logoff after inactivity
- ✅ Tenant data isolation
- ✅ Audit logging for PHI access
- ✅ Document encryption at rest
- ✅ Role-based access control

### HIPAA Compliance
- PHI access logging with 7-year retention
- Encrypted document storage
- Secure file upload with validation
- Tenant-scoped data access

---

## 🛠️ Tech Stack

### Backend
- **Medusa.js 2.13.1** - Headless commerce framework
- **PostgreSQL** - Primary database
- **Redis** - Rate limiting & caching
- **TypeScript** - Type safety
- **Jest** - Testing framework

### Storefront
- **Next.js 15** - React framework
- **Tailwind CSS** - Styling
- **Medusa JS SDK** - Backend integration

### Infrastructure
- **Docker** - Containerization
- **AWS S3** - Document storage
- **Stripe** - Payment processing
- **SendGrid** - Email notifications

---

## 📞 Support

For questions or issues:
1. Check [docs/](docs/) for documentation
2. Review [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
3. Contact the development team

---

## 📝 License

Proprietary - TheRxSpot Internal Use Only
