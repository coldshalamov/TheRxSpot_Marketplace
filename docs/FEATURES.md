# Features - TheRxSpot Marketplace

**White-Label Telehealth Platform**

This document describes the features based on the actual partner dashboard we're replacing.

---

## 1. Multi-Tenant Business Management

### Business Setup
- **Create Businesses** - Set up new tenant organizations
- **Custom Branding**
  - Business name, tagline, description
  - Logo upload
  - Custom colors/styling (future)
- **Contact Information**
  - Phone number
  - Address (street, unit, city, state, zip)
  - Country

### Platform Fees
- **Client-Paid Service Fee** - Additional fee paid by customer
  - Mode: Fixed amount or percentage
  - Amount configuration
- **Business Commission Fee** - Platform cut from business revenue
  - Mode: Percentage
  - Amount: Default 5%

### Custom Domain
- **Domain Mapping** - `patients.{businessdomain}.com`
  - Domain input field
  - Verification status (Pending, Verified)
  - DNS instructions
  - Verification check
- **Location URLs** - Each location gets unique URL
  - Format: `https://patients.therxspot.com/business/{businessId}/{locationId}`

### Custom Tracking
- **HTML Script Injection** - Google Analytics, Facebook Pixel, etc.
  - Validate `<script>` tags
  - Inject into storefront `<head>`

### Status Management
- **Active/Inactive Toggle**
  - Active: Business operational, storefront live
  - Inactive: Business disabled, storefront offline

---

## 2. Location Management

### Location Setup
- **Multi-Location Support** - Businesses can have multiple locations
- **Location Information**
  - Name
  - Phone
  - Address (same as business)
  - Operation type: Virtual

### Serviceable States
- **State Selection** - Multi-select from all US states
  - Determines where business can serve customers
  - Used for licensing/compliance gating
  - Future: Block orders from non-serviceable states

### Location-Specific Product Catalog
- **Product Enablement** - Enable/disable products per location
  - Manage which products appear on location's storefront
  - Different locations can offer different catalogs

---

## 3. User (Client) Management

### User List
- **Search** - By name, email
- **Filters**
  - Status: All, Active, Inactive
  - Role: All roles (currently just "Client")
- **Display Fields**
  - First name, Last name
  - Email
  - Phone (formatted: +15163185880)
  - Date of birth (DD MMM YYYY format)
  - Status badge (Active/Inactive)
  - Role(s) (Client)
  - Created date (DD MMM YYYY, HH:mm am/pm TZ)
- **Actions** - View, Edit, Deactivate

### User Detail
- Profile information
- Order history
- Consultation history

---

## 4. Consultation Management

### Consultation List
- **Search** - By client name, HCP name, order ID, item ID
- **Filters**
  - Status: All, Scheduled, Completed, Incomplete, Cancelled, No Show
  - Mode: All, Video Call, Audio Call, Form
  - Type: All, Initial, Follow-up
- **Display Fields**
  - Consultation ID (e.g., CO-AQL631)
  - Client name
  - Healthcare provider (clinician) name
  - Business name
  - Date/Time (DD MMM YYYY, HH:mm am/pm TZ)
  - State (e.g., Florida)
  - Status badge
  - Mode (Video Call, Audio Call, Form)
  - Product name
  - Type (Initial, Follow-up)
- **Actions** - View details, Update status, Assign clinician

### Consultation Detail
- **Patient Information** - Name, contact, state
- **Consultation Details**
  - Scheduled time
  - Mode
  - Product
  - Chief complaint
  - Medical history
- **Status History** - Timeline of status changes
- **Documents** - Attached prescriptions, records
- **Clinician Assignment** - Assign to available clinician
- **Actions**
  - Update status
  - Approve/reject eligibility
  - Generate order (if approved)

### Consultation Statuses
- **Scheduled** - Appointment booked
- **In Progress** - Consultation ongoing
- **Completed** - Finished, outcome recorded
- **Incomplete** - Follow-up required
- **No Show** - Patient didn't attend
- **Cancelled** - Cancelled by patient or clinician

---

## 5. Order Management

### Order List
- **Search** - By order ID, product, client name, email
- **Filters**
  - Order status: All, Pending, Payment Pending, In Production, Shipped, Delivered, Cancelled
  - Location: All locations
  - Product: All products
  - Order date range
- **Display Fields**
  - Order ID (e.g., OD-NUB966)
  - Product name(s)
  - Type (Initial, Refill)
  - Status badge
  - Client name
  - Business name
  - Location name
  - Order date (DD MMM YYYY, HH:mm am/pm TZ)
- **Tabs**
  - Orders - Summary view
  - Order Items - Individual line items
- **Actions** - View details, Update status, Refund

### Order Detail
- **Order Summary**
  - Order ID
  - Customer info
  - Order total
  - Payment status
- **Line Items**
  - Product name
  - Dosage (variant)
  - Quantity
  - Price
  - Consult fee (if applicable)
- **Status Timeline** - Track order progression
- **Fulfillment Information**
  - Shipping address
  - Tracking number (if shipped)
  - Delivery date
- **Consultation Link** - If order requires consultation

### Order Statuses
- **Order Payment Pending** - Awaiting payment
- **Pending** - Payment received, not yet processed
- **In Production** - Being prepared/compounded
- **Shipped** - En route to customer
- **Medication Delivered** - Successfully delivered
- **Cancelled** - Order cancelled

---

## 6. Product Management

### Product Catalog
- **Use Medusa Admin** - Built-in product management
- **Custom Fields**
  - `requires_consult` (boolean) - Does product need consultation?
  - `consult_fee` (amount) - Fee for consultation if required
  - `type` (Initial, Refill)

### Categories
- Appetite Suppressant
- Weight Management
- Peptides
- Anti-Aging
- Sexual Health
- Hair Loss

### Product Types
- **Initial** - First-time purchase, requires consultation
- **Refill** - Repeat purchase, may not require new consultation

---

## 7. Coupon Management

### Coupon List
- **Search** - By coupon code, name
- **Filters**
  - Status: All, Active, Inactive
  - Discount type: All, Fixed Amount, Percentage
- **Display Fields**
  - Coupon name (e.g., "Badabing 165")
  - Code (e.g., "badabing165")
  - Discount type (Fixed amount, Percentage)
  - Amount/Percentage value
  - Usage limits (Yes/No)
  - Date restrictions (Yes/No)
  - Status (Active/Inactive)
  - Created date
- **Actions** - Edit, Activate/Deactivate, Delete

### Coupon Creation
- **Basic Info**
  - Name
  - Code (unique)
- **Discount Type**
  - Fixed amount ($)
  - Percentage (%)
- **Restrictions**
  - Usage limit (total times usable)
  - Per-customer limit
  - Start/end dates
  - Minimum order value
  - Specific products/categories
- **Business Scope** - Apply to specific business or platform-wide

---

## 8. Earnings & Payouts

### Earnings Dashboard
- **Summary Cards**
  - **Pending Payout** - Total awaiting payout ($0.00)
  - **Total Earnings** - Total commission earned since inception ($24.14)
  - **Commission Balance** - Total available now ($-20.86)
  - **Available Payout** - Amount user can request ($-20.86)
  - **Commission Pending** - Not yet available ($0.00)

### Earnings List
- **Search** - By order ID
- **Filters**
  - Location: All locations
  - Date range picker
- **Display Fields**
  - Order ID (e.g., OD-NUB966)
  - Location name
  - Date (DD MMM YYYY, HH:mm am/pm TZ)
  - Type (Commission, Payout)
  - Amount (positive/negative, e.g., -22.35, +45.00)
  - Payment method (if payout)
  - Status (N/A for commission, status for payout)
  - Actions

### Payout Request
- **Create Payout** - Button to request payout
- **Payout Methods**
  - Bank transfer
  - Check
  - PayPal (future)

### Commission Calculation
**Per Order:**
```
Medication Sale ($100):
  - Gross: $100.00
  - Platform Fee (5%): $5.00
  - Business Keeps: $95.00

Consultation Fee ($50):
  - Gross: $50.00
  - Platform Fee (5%): $2.50
  - Business Keeps: $47.50
```

---

## 9. Storefront (Customer-Facing)

### Homepage
- Hero section with business branding
- Category cards with images
- Tagline and description

### Category Pages
- Product grid
- Filter by type (Initial, Refill)
- Search products

### Product Detail
- Product image
- Description
- Dosage selection (variants)
- Price display
- "Add to Cart" button
- **Consult-Required Indicator** - If product needs consultation

### Consult-Gating Flow
**If product requires consultation:**
1. Customer clicks "Add to Cart"
2. Modal appears: "This product requires a consultation"
3. Options:
   - Schedule consultation (link to external booking)
   - Complete eligibility form (form consult)
4. Cannot add to cart until consultation approved

### Cart
- Line items: product + dosage
- Consult fee (if applicable) as separate line item
- Medication fee
- Total calculation
- Coupon code input
- "Proceed to Checkout" button

### Checkout
- Shipping address
- Billing address
- Payment method (Stripe)
- Order summary
- Breakdown:
  - Consult fee: $50
  - Medication fee: $100
  - **Total: $150**
- Place Order button

### Customer Account
- Order history
- Consultation history
- Download documents (prescriptions)
- Profile settings

---

## 10. Security & Compliance

### Document Management
- **Upload Documents** - Prescriptions, IDs, medical records
  - Virus scanning (ClamAV)
  - MIME type validation
  - Max 10MB per file
  - Supported: PDF, JPG, PNG, TIFF

### Audit Logging
- **PHI Access Tracking** - Log all access to protected health information
  - Actor (user ID, email)
  - Action (create, read, update, delete, download)
  - Entity (document, consultation, patient)
  - Timestamp
  - IP address
  - Risk level (low, medium, high, critical)

### Rate Limiting
- **Redis-Based** - Distributed rate limiting
  - Auth endpoints: 5 requests per 15 minutes
  - Consult submissions: 3 per hour
  - General API: 100 per 15 minutes
  - Password reset: 3 per hour

### Tenant Isolation
- **Data Scoping** - Ensure tenants can only access their own data
  - Middleware enforces business_id filtering
  - API routes validate tenant context
  - Admin routes check business ownership

### Auto-Logoff
- **Inactivity Timeout** - Log out after 15 minutes inactive

---

## Features NOT Implemented (Out of Scope)

These are handled by partners/offsite:
- ❌ **Video Consultation Platform** - Use external provider (Zoom, Doxy.me)
- ❌ **Prescription Fulfillment** - Pharmacy partner handles
- ❌ **Doctor Scheduling** - Link to external booking system
- ❌ **Electronic Prescribing** - Doctor sends to pharmacy directly
- ❌ **Lab Orders** - Not needed for telehealth model

---

## Future Enhancements (V2)

### Short-term
- Email notifications (order confirmation, consult scheduled)
- SMS notifications
- More payment methods (PayPal, Apple Pay)
- Automated domain verification
- Referral program

### Medium-term
- Advanced analytics dashboard
- Custom branding themes per tenant
- Subscription/recurring orders
- Affiliate program
- Marketing automation

### Long-term
- Mobile app (React Native)
- Inventory management
- Multi-language support
- International expansion
