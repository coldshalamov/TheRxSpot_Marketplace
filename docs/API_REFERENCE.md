# API Reference

Complete API documentation for TheRxSpot Medusa.js Telehealth Marketplace.

## Table of Contents

- [Authentication](#authentication)
- [Consultations](#consultations)
- [Clinicians](#clinicians)
- [Patients](#patients)
- [Earnings & Payouts](#earnings--payouts)
- [Documents](#documents)
- [Audit Logs](#audit-logs)
- [Businesses](#businesses)
- [Error Codes](#error-codes)

---

## Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:

```http
Authorization: Bearer <jwt_token>
```

For admin routes, cookie-based sessions are also supported.

### Token Lifespan

- Access tokens: 1 hour
- Refresh tokens: 7 days

---

## Consultations

### List Consultations (Admin)

```http
GET /admin/consultations
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status (draft, scheduled, in_progress, completed, incomplete, no_show, cancelled) |
| business_id | string | Filter by business |
| patient_id | string | Filter by patient |
| clinician_id | string | Filter by clinician |
| limit | number | Number of results to return (default: 20) |
| offset | number | Pagination offset |

**Response:**

```json
{
  "consultations": [
    {
      "id": "consult_123",
      "business_id": "bus_456",
      "patient_id": "pat_789",
      "clinician_id": "clin_012",
      "mode": "video",
      "status": "completed",
      "scheduled_at": "2026-02-15T10:00:00Z",
      "started_at": "2026-02-15T10:05:00Z",
      "ended_at": "2026-02-15T10:25:00Z",
      "duration_minutes": 20,
      "outcome": "approved",
      "approved_medications": ["prod_001", "prod_002"],
      "chief_complaint": "Headache",
      "assessment": "Tension headache",
      "plan": "Rest and hydration",
      "notes": "Patient responded well"
    }
  ],
  "count": 1,
  "offset": 0,
  "limit": 20
}
```

### Create Consultation (Admin)

```http
POST /admin/consultations
```

**Request Body:**

```json
{
  "business_id": "bus_456",
  "patient_id": "pat_789",
  "mode": "video",
  "scheduled_at": "2026-02-15T10:00:00Z",
  "chief_complaint": "Headache"
}
```

### Get Consultation by ID (Admin)

```http
GET /admin/consultations/:id
```

### Update Consultation (Admin)

```http
PUT /admin/consultations/:id
```

### Transition Status (Admin)

```http
POST /admin/consultations/:id/status
```

**Request Body:**

```json
{
  "status": "in_progress",
  "reason": "Starting consultation"
}
```

### Assign Clinician (Admin)

```http
POST /admin/consultations/:id/assign
```

**Request Body:**

```json
{
  "clinician_id": "clin_012"
}
```

### Complete Consultation (Admin)

```http
POST /admin/consultations/:id/complete
```

**Request Body:**

```json
{
  "outcome": "approved",
  "notes": "Consultation completed successfully",
  "assessment": "Patient is healthy",
  "plan": "Continue current treatment",
  "approved_medications": ["prod_001"]
}
```

### List Consultations (Store)

```http
GET /store/consultations
```

Returns consultations for the authenticated customer.

### Create Consultation (Store)

```http
POST /store/consultations
```

**Request Body:**

```json
{
  "business_id": "bus_456",
  "mode": "async_form",
  "chief_complaint": "Headache",
  "medical_history": {
    "conditions": ["hypertension"],
    "medications": ["lisinopril"]
  }
}
```

### Cancel Consultation (Store)

```http
POST /store/consultations/:id/cancel
```

**Request Body:**

```json
{
  "reason": "Patient requested cancellation"
}
```

### Get Available Slots (Store)

```http
GET /store/consultations/available-slots
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| clinician_id | string | Filter by clinician |
| date_from | string | Start date (ISO 8601) |
| date_to | string | End date (ISO 8601) |

---

## Clinicians

### List Clinicians (Admin)

```http
GET /admin/clinicians
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status (active, inactive, suspended) |
| business_id | string | Filter by business |
| is_platform_clinician | boolean | Filter platform clinicians |

### Create Clinician (Admin)

```http
POST /admin/clinicians
```

**Request Body:**

```json
{
  "business_id": "bus_456",
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane.smith@clinic.com",
  "phone": "+1-555-0123",
  "npi_number": "1234567890",
  "license_number": "MD12345",
  "license_state": "CA",
  "license_expiry": "2027-12-31",
  "credentials": ["MD", "Board Certified"],
  "specializations": ["Family Medicine", "Telehealth"],
  "timezone": "America/Los_Angeles"
}
```

### Get Clinician by ID (Admin)

```http
GET /admin/clinicians/:id
```

### Update Clinician (Admin)

```http
PUT /admin/clinicians/:id
```

### Delete Clinician (Admin)

```http
DELETE /admin/clinicians/:id
```

### Get Clinician Availability (Admin)

```http
GET /admin/clinicians/:id/availability
```

### Update Clinician Schedule (Admin)

```http
PUT /admin/clinicians/:id/schedule
```

**Request Body:**

```json
{
  "schedule": [
    {
      "day_of_week": 1,
      "start_time": "09:00",
      "end_time": "17:00",
      "is_available": true
    }
  ]
}
```

---

## Patients

### List Patients (Admin)

```http
GET /admin/patients
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| business_id | string | Filter by business |
| email | string | Filter by email |

### Get Patient by ID (Admin)

```http
GET /admin/patients/:id
```

### Update Patient (Admin)

```http
PUT /admin/patients/:id
```

---

## Earnings & Payouts

### Get Earnings Summary (Admin)

```http
GET /admin/earnings/summary
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| business_id | string | Required. Filter by business |

**Response:**

```json
{
  "available": 50000,
  "pending": 20000,
  "lifetime": 150000,
  "ytd_payouts": 80000,
  "next_payout_date": "2026-02-10T00:00:00Z"
}
```

*Note: All monetary values are in cents (smallest currency unit)*

### List Earnings (Admin)

```http
GET /admin/earnings
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| business_id | string | Filter by business |
| status | string | Filter by status (pending, available, paid, reversed) |
| type | string | Filter by type (product_sale, consultation_fee, shipping_fee, etc.) |
| date_from | string | Filter by date from |
| date_to | string | Filter by date to |

### Create Payout (Admin)

```http
POST /admin/payouts
```

**Request Body:**

```json
{
  "business_id": "bus_456",
  "earning_ids": ["earn_001", "earn_002"],
  "method": "stripe_connect"
}
```

### List Payouts (Admin)

```http
GET /admin/payouts
```

### Get Payout by ID (Admin)

```http
GET /admin/payouts/:id
```

### Process Payout (Admin)

```http
POST /admin/payouts/:id/process
```

### Cancel Payout (Admin)

```http
POST /admin/payouts/:id/cancel
```

**Request Body:**

```json
{
  "reason": "Cancelled by admin"
}
```

### Get Tenant Earnings Summary (Tenant)

```http
GET /admin/tenant/earnings/summary
```

Returns earnings summary for the authenticated tenant's business.

### Get Tenant Earnings (Tenant)

```http
GET /admin/tenant/earnings
```

### Get Tenant Payouts (Tenant)

```http
GET /admin/tenant/payouts
```

---

## Documents

### List Documents (Admin)

```http
GET /admin/documents
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| business_id | string | Filter by business |
| patient_id | string | Filter by patient |
| type | string | Filter by type (prescription, lab_result, medical_record, etc.) |
| access_level | string | Filter by access level |

### Create Document (Admin)

```http
POST /admin/documents
```

**Request Body (multipart/form-data):**

```
file: <binary>
type: "prescription"
patient_id: "pat_789"
title: "Prescription for Antibiotics"
description: "Amoxicillin 500mg"
access_level: "patient_only"
```

### Get Document by ID (Admin)

```http
GET /admin/documents/:id
```

### Delete Document (Admin)

```http
DELETE /admin/documents/:id
```

### Generate Download URL (Admin)

```http
GET /admin/documents/:id/download
```

**Response:**

```json
{
  "url": "https://presigned-url.s3.amazonaws.com/...",
  "expires_at": "2026-02-03T19:00:00Z"
}
```

### List Documents (Store)

```http
GET /store/documents
```

Returns documents accessible to the authenticated customer.

---

## Audit Logs

### List Audit Logs (Admin)

```http
GET /admin/audit-logs
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| business_id | string | Filter by business |
| entity_type | string | Filter by entity type |
| entity_id | string | Filter by entity ID |
| actor_id | string | Filter by actor ID |
| action | string | Filter by action (create, read, update, delete, download) |
| risk_level | string | Filter by risk level (low, medium, high, critical) |
| flagged | boolean | Filter flagged entries |
| date_from | string | Filter by date from |
| date_to | string | Filter by date to |
| limit | number | Number of results (default: 50, max: 1000) |

**Response:**

```json
{
  "audit_logs": [
    {
      "id": "audit_001",
      "actor_type": "clinician",
      "actor_id": "clin_123",
      "actor_email": "doctor@clinic.com",
      "action": "read",
      "entity_type": "patient",
      "entity_id": "pat_456",
      "business_id": "bus_789",
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "changes": null,
      "risk_level": "low",
      "flagged": false,
      "created_at": "2026-02-03T10:00:00Z"
    }
  ],
  "count": 1,
  "offset": 0,
  "limit": 50
}
```

### Get Flagged Audit Logs (Admin)

```http
GET /admin/audit-logs/flagged
```

### Get High Risk Audit Logs (Admin)

```http
GET /admin/audit-logs/high-risk
```

---

## Businesses

### List Businesses (Admin)

```http
GET /admin/businesses
```

### Create Business (Admin)

```http
POST /admin/businesses
```

**Request Body:**

```json
{
  "name": "Healthy Pharmacy",
  "slug": "healthy-pharmacy",
  "domain": "healthypharmacy.com",
  "settings": {
    "requires_consultation": true,
    "auto_approve": false
  }
}
```

### Get Business by ID (Admin)

```http
GET /admin/businesses/:id
```

### Update Business (Admin)

```http
PUT /admin/businesses/:id
```

### Provision Business (Admin)

```http
POST /admin/businesses/:id/provision
```

Creates sales channel and API key for the business.

### Get Business QR Code (Admin)

```http
GET /admin/businesses/:id/qr-code
```

### Get Tenant Profile (Tenant)

```http
GET /admin/tenant/me
```

Returns the current tenant's business profile.

### Update Tenant Branding (Tenant)

```http
PUT /admin/tenant/branding
```

**Request Body:**

```json
{
  "primary_color": "#0066CC",
  "secondary_color": "#00AA66",
  "logo_url": "https://cdn.example.com/logo.png"
}
```

---

## Consult Submissions

### List Consult Submissions (Admin)

```http
GET /admin/consult-submissions
```

### Get Consult Submission by ID (Admin)

```http
GET /admin/consult-submissions/:id
```

### Approve Consult Submission (Admin)

```http
POST /admin/consult-submissions/:id/approve
```

### Reject Consult Submission (Admin)

```http
POST /admin/consult-submissions/:id/reject
```

**Request Body:**

```json
{
  "notes": "Insufficient information provided"
}
```

---

## Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `CONSULT_REQUIRED` | Product requires consultation approval before purchase | 403 |
| `CONSULT_EXPIRED` | Consult approval has expired | 403 |
| `CONSULT_REJECTED` | Consult was rejected for this product | 403 |
| `INVALID_STATUS_TRANSITION` | The requested status change is not allowed | 400 |
| `INSUFFICIENT_FUNDS` | Payout amount exceeds available earnings | 400 |
| `ACCESS_DENIED` | User does not have permission to access this resource | 403 |
| `ENTITY_NOT_FOUND` | The requested resource was not found | 404 |
| `VALIDATION_ERROR` | Request validation failed | 422 |
| `RATE_LIMIT_EXCEEDED` | Too many requests, please try again later | 429 |
| `UNAUTHORIZED` | Authentication required | 401 |
| `INVALID_CREDENTIALS` | Invalid email or password | 401 |
| `ACCOUNT_SUSPENDED` | Account has been suspended | 403 |
| `CLINICIAN_NOT_AVAILABLE` | Selected clinician is not available | 400 |
| `SCHEDULING_CONFLICT` | Time slot is no longer available | 409 |
| `DOCUMENT_TOO_LARGE` | File exceeds maximum size limit | 413 |
| `INVALID_FILE_TYPE` | File type not allowed | 415 |
| `CHECKSUM_MISMATCH` | Document integrity verification failed | 400 |
| `PAYOUT_PROCESSING_FAILED` | Unable to process payout | 500 |
| `STRIPE_ERROR` | Payment provider error | 502 |
| `INTERNAL_ERROR` | Internal server error | 500 |

---

## Rate Limits

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Authentication | 5 requests | 1 minute |
| Consultation submissions | 10 requests | 1 minute |
| API (general) | 100 requests | 1 minute |
| Document uploads | 10 requests | 1 minute |

Rate limit information is included in response headers:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: Unix timestamp when limit resets

---

## Pagination

List endpoints support pagination using `limit` and `offset` parameters:

```http
GET /admin/consultations?limit=20&offset=40
```

Response includes pagination metadata:

```json
{
  "data": [...],
  "count": 100,
  "limit": 20,
  "offset": 40
}
```

---

## Webhooks

The platform supports webhooks for the following events:

- `order.placed`
- `order.status_changed`
- `consultation.completed`
- `payout.processed`
- `document.uploaded`

Configure webhooks in the admin dashboard or via the API.
