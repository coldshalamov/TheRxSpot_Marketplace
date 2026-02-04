# API Reference (Custom Endpoints)

This project uses Medusa v2 file-based routing under `src/api/**/route.ts`.

## Authentication Notes

- **Store** endpoints require a **publishable API key** header: `x-publishable-api-key`.
- **Store customer auth** can be a session cookie or a Bearer JWT (depends on your auth flow).
- **Admin** endpoints require admin authentication (Bearer JWT for a `user` actor, or Basic auth with a secret `sk_` API key).

---

## Store: Consultation Approval

### `GET /store/consultations/approvals?product_id={id}`

Checks whether the authenticated customer has a valid **approved** consultation for the given product within the last **90 days**.

**Headers**
- `x-publishable-api-key: <publishable_token>`
- `Authorization: Bearer <customer_jwt>`
- `x-business-slug: <tenant_slug>` (required for tenant resolution in this repo)

**Response 200**
```json
{
  "has_valid_approval": true,
  "consultation_id": "consult_123",
  "expires_at": "2026-05-01T12:00:00.000Z"
}
```

**Response 200 (no valid approval)**
```json
{
  "has_valid_approval": false,
  "consultation_id": null,
  "expires_at": null
}
```

**Example**
```bash
curl -sS -X GET \
  "http://localhost:9000/store/consultations/approvals?product_id=prod_123" \
  -H "x-publishable-api-key: pk_..." \
  -H "x-business-slug: acme" \
  -H "Authorization: Bearer <customer_jwt>"
```

---

## Admin: Assign Clinician

### `POST /admin/consultations/{id}/assign`

Assigns a clinician to a consultation. If the consultation is still `draft` (treated as "pending" in PLAN terms), the endpoint will move it to `scheduled` and set `scheduled_at` if missing.

Creates a compliance audit log entry and emits a best-effort event `consultation.assigned`.

**Headers**
- `Authorization: Bearer <admin_user_jwt>`

**Body**
```json
{
  "clinician_id": "clin_123"
}
```

**Response 200**
```json
{
  "consultation": {
    "id": "consult_123",
    "business_id": "bus_123",
    "status": "scheduled",
    "clinician_id": "clin_123",
    "scheduled_at": "2026-02-04T13:00:00.000Z",
    "updated_at": "2026-02-04T13:00:01.000Z"
  }
}
```

**Example**
```bash
curl -sS -X POST \
  "http://localhost:9000/admin/consultations/consult_123/assign" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_user_jwt>" \
  -d '{ "clinician_id": "clin_123" }'
```

---

## Admin: Update Consultation Status (PLAN State Machine)

### `POST /admin/consultations/{id}/status`

Enforces the PLAN state machine:

`pending -> scheduled -> completed -> approved | rejected`

Implementation mapping in this repo:
- **pending** = `consultation.status = "draft"`
- **scheduled** = `consultation.status = "scheduled"`
- **completed** = `consultation.status = "completed"`
- **approved/rejected** = `consultation.outcome = "approved" | "rejected"` (status remains `completed`)

Also writes to the compliance `audit_log` and appends a `consultation_status_event`.

**Headers**
- `Authorization: Bearer <admin_user_jwt>`

**Body**
```json
{
  "status": "scheduled"
}
```

**Reject body (reason required)**
```json
{
  "status": "rejected",
  "reason": "Missing required info"
}
```

**Response 409 (invalid transition)**
```json
{
  "code": "INVALID_STATE_TRANSITION",
  "message": "Invalid transition from pending to approved. Allowed: scheduled"
}
```

**Example**
```bash
curl -sS -X POST \
  "http://localhost:9000/admin/consultations/consult_123/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_user_jwt>" \
  -d '{ "status": "completed" }'
```

---

## Admin: Consultation Documents (PLAN)

### `POST /admin/consultations/{id}/documents`

Upload a document for a consultation using `multipart/form-data`.

Validation (PLAN):
- Allowed types: **PDF**, **JPG**, **PNG**
- Max size: **10MB** (controlled by `DOCUMENT_MAX_SIZE`, default 10MB)
- Virus scan: ClamAV if available, otherwise content validation fallback

**Headers**
- `Authorization: Bearer <admin_user_jwt>`

**Form fields**
- `document` (file, required)
- `type` (required): `prescription | lab_result | medical_record | consent_form | id_verification | insurance_card | other`
- `title` (required)
- `description` (optional)
- `access_level` (required): `patient_only | clinician | business_staff | platform_admin`
- `expires_at` (optional, ISO date)

**Example**
```bash
curl -sS -X POST \
  "http://localhost:9000/admin/consultations/consult_123/documents" \
  -H "Authorization: Bearer <admin_user_jwt>" \
  -F "document=@./example.pdf;type=application/pdf" \
  -F "type=medical_record" \
  -F "title=Initial Intake" \
  -F "access_level=clinician"
```

---

### `GET /admin/documents?consultation_id={id}`

Lists documents for a consultation. (This repo logs a security warning if PHI identifiers are passed as query params, but still supports `consultation_id` for this endpoint.)

**Headers**
- `Authorization: Bearer <admin_user_jwt>`

**Example**
```bash
curl -sS -X GET \
  "http://localhost:9000/admin/documents?consultation_id=consult_123" \
  -H "Authorization: Bearer <admin_user_jwt>"
```

---

### `GET /admin/documents/{id}/download`

Downloads a document.

- **Local dev**: streams the file content directly (so downloads work without static `/uploads` hosting).
- **S3** (future): can return a signed URL by adding `?signed_url=1` (expires in 5 minutes by default).

**Headers**
- `Authorization: Bearer <admin_user_jwt>`

**Query params**
- `disposition=inline|attachment` (stream mode; defaults to `inline` for PDFs)
- `signed_url=1` (return JSON with `download_url` instead of streaming)
- `expires_in=300` (signed URL mode; seconds)

**Example (stream to file)**
```bash
curl -sS -L \
  "http://localhost:9000/admin/documents/doc_123/download" \
  -H "Authorization: Bearer <admin_user_jwt>" \
  -o downloaded.pdf
```

---

## Admin: Earnings Summary (PLAN)

### `GET /admin/earnings/summary`

Returns integer-cent totals for a business over an optional date range.

**Headers**
- `Authorization: Bearer <admin_user_jwt>`

**Query params**
- `business_id` (required): the business to summarize
- `date_from` (optional, ISO date): filter `created_at >= date_from`
- `date_to` (optional, ISO date): filter `created_at <= date_to`

**Response 200**
```json
{
  "business_id": "bus_123",
  "date_from": "2026-02-01T00:00:00.000Z",
  "date_to": "2026-02-04T23:59:59.000Z",
  "pending_payout": 12000,
  "total_earnings": 45000,
  "commission_balance": 33000,
  "available_payout": 33000,
  "breakdown": {
    "commission": 15000,
    "consultation_fee": 20000,
    "service_fee": 10000
  }
}
```

**Response 400**
```json
{
  "code": "INVALID_INPUT",
  "message": "business_id is required"
}
```

**Example**
```bash
curl -sS -X GET \
  "http://localhost:9000/admin/earnings/summary?business_id=bus_123&date_from=2026-02-01T00:00:00.000Z&date_to=2026-02-04T23:59:59.000Z" \
  -H "Authorization: Bearer <admin_user_jwt>"
```

---

## Admin: Payout Requests (PLAN)

### `POST /admin/payouts`

Creates a payout request from the business's **available** earnings balance.

- Amounts are integer **cents**.
- Uses basic idempotency via `Idempotency-Key` (header) or `idempotency_key` (body).
- Marks selected earnings as `paid_out` and links them to the created payout.
- Writes a compliance audit log entry and emits a best-effort `payout.requested` event (email infra is not wired yet).

**Headers**
- `Authorization: Bearer <admin_user_jwt>`
- `Idempotency-Key: <unique_key>` (optional but recommended)

**Body (amount-based payout)**
```json
{
  "business_id": "bus_123",
  "amount": 25000,
  "method": "stripe_connect"
}
```

**Body (explicit selection)**
```json
{
  "business_id": "bus_123",
  "earning_entry_ids": ["earn_123", "earn_456"],
  "amount": 12000,
  "method": "ach",
  "destination_account": "acct_ach_123"
}
```

**Response 201**
```json
{
  "payout": {
    "id": "payout_123",
    "business_id": "bus_123",
    "status": "pending",
    "method": "stripe_connect",
    "net_amount": 25000
  }
}
```

**Response 200 (idempotent re-play)**
```json
{
  "payout": { "id": "payout_123" },
  "idempotent": true
}
```

**Error codes (examples)**
- `NO_AVAILABLE_BALANCE` (no earnings available)
- `AMOUNT_EXCEEDS_AVAILABLE` (amount is greater than available balance)
- `AMOUNT_MISMATCH` (when `earning_entry_ids` is provided, `amount` must match sum)

**Example**
```bash
curl -sS -X POST \
  "http://localhost:9000/admin/payouts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_user_jwt>" \
  -H "Idempotency-Key: payout_bus_123_20260204_0001" \
  -d '{ "business_id": "bus_123", "amount": 25000, "method": "stripe_connect" }'
```
