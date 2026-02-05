# System Integration Plan: TheRxSpot Hub & Marketplace

## 1. The High-Level Architecture
You currently have two distinct systems. The goal is to make them act as one "Control Plane" and one "Execution Plane".

*   **System A (The Hub - PHP):** The **Controller**.
    *   **Role:** Affiliate recruitment, onboarding, payout management, and "Identity Provider".
    *   **User Action:** Affiliate signs up, picks a subdomain (e.g., `best-health.therxspot.com`), and manages their profile.
    *   **Data Owned:** User identity, commission rules, subdomain choice.

*   **System B (The Marketplace - Medusa.js):** The **Engine**.
    *   **Role:** The white-label e-commerce platform and telemedicine backend.
    *   **User Action:** Patients buy products, Clinicians review consults.
    *   **Data Owned:** Products, Orders, Patients, Consultations, and the **Business** entity (the white-label shop).

## 2. The Integration Bridge (The Missing Link)
Currently, System A saves a subdomain to its local SQLite database, but System B doesn't know about it. We need to build a **Bridge**.

### The Flow
1.  **Trigger:** Affiliate enters `marketplace.php` in the Hub and clicks "Claim Subdomain".
2.  **Action:** `save_subdomain.php` executes.
3.  **Integration:**
    *   PHP script instantiates a new `MedusaClient` class.
    *   PHP sends `POST /admin/businesses` to Medusa API.
    *   Payload: `{ "name": "Affiliate Name", "handle": "best-health", "admin_email": "affiliate@email.com" }`
4.  **Result:**
    *   Medusa creates the `Business` tenant.
    *   Medusa creates a specific `SalesChannel` for them.
    *   Medusa returns the new `business_id`.
5.  **Persistence:**
    *   PHP saves `business_id` into `app.db` (linking the two systems).
    *   PHP displays "Launch Store" button linking to `https://best-health.therxspot.com`.

## 3. Implementation Roadmap

### Phase 1: The PHP Connector (Immediate)
*   **Create:** `D:\GitHub\Telomere\TheRxSpot.com\auth\lib\medusa-client.php`
    *   A simple wrapper for cURL requests to your Medusa backend.
    *   Requires a `MEDUSA_ADMIN_TOKEN` (we will generate this).
*   **Update:** `D:\GitHub\Telomere\TheRxSpot.com\auth\api\save_subdomain.php`
    *   Inject the `MedusaClient`.
    *   Call `createBusiness()` on success.

### Phase 2: The Medusa Receiver (In Progress)
*   You already have the `Business` module in Medusa.
*   Ensure `POST /admin/businesses` is active and accepts the provisioning payload.
*   Ensure it automatically creates a `Store` or `SalesChannel` for that business.

### Phase 3: The Dashboard Synchronization
*   When an affiliate logs into PHP, we might want to show them "Recent Orders" from Medusa.
*   **Strategy:** On PHP Dashboard load, call Medusa API `GET /admin/orders?sales_channel_id=X` and render a widget. This keeps data in Medusa (source of truth) but visible in PHP.

## 4. How to Keep Track (Organization Strategy)
Since you are a single developer/small team managing two complex repos:

1.  **Rule of Separation:**
    *   **Visual/Marketing specific to the Affiliate?** -> PHP Repo.
    *   **Product/Order/Patient specific?** -> Medusa Repo.

2.  **Shared Documentation:**
    *   Keep this `SYSTEM_INTEGRATION_PLAN.md` in the **Marketplace** repo (as it's the newer, stricter system).
    *   In the PHP repo, add a `MARKETPLACE_INTEGRATION.md` that simply points to the implementation details of the client.

3.  **Unified Secrets:**
    *   You will need a secure way to share the API Token. In PHP, we'll likely use a simple `config.php` or `.env` file (if supported/safe) to store the `MEDUSA_HOST` and `MEDUSA_TOKEN`.

## Next Steps
1.  **Approve this plan.**
2.  **Task 1:** I will create the `MedusaClient.php` in the PHP repo.
3.  **Task 2:** I will verifying the Medusa `POST /admin/businesses` endpoint exists and matches what PHP will send.
