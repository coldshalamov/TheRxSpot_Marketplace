# MEDUSA V2.13.1 DEVELOPER CONTEXT ("EASY MODE")

**IMPORTANT: This project uses Medusa v2.13.1. The architecture is fundamentally different from v1.**
**AI AGENTS: READ THIS FILE BEFORE WRITING ANY CODE.**

## 1. Core Architecture (V2 vs V1)

*   **Modules (Strict Isolation):** Medusa v2 uses a modular architecture. Modules (in `src/modules`) are isolated and cannot access each other's databases directly. You MUST use the **Module Service** or **Workflows**.
    *   *Bad (V1):* Injecting `ProductService` into `CartService`.
    *   *Good (V2):* Using a **Workflow** to orchestrate `cart` and `product` operations.
*   **Workflows (Required):** All business logic involving multiple modules (e.g., "Add to Cart", "Create Order") MUST use **Medusa Workflows** (`@medusajs/framework/workflows-sdk`).
    *   Do NOT just write long service functions.
    *   Rollbacks are handled automatically by workflows. 
*   **API Routes:**
    *   Located in `src/api`.
    *   Pattern: `export async function GET(req: MedusaRequest, res: MedusaResponse)` in `route.ts` files.
    *   **NOT** Express style `router.get(...)`.

## 2. Project Structure

*   `src/modules`: Custom business logic modules.
*   `src/workflows`: Workflows that combine modules.
*   `src/api`: API Routes (Next.js App Router style).
*   `medusa-config.ts`: Configuration (check for Redis/DB settings).

## 3. Stability & "Hanging" Fixes

If Medusa "hangs" or crashes:

1.  **Redis is Critical:** V2 relies heavily on Redis for the Event Bus and Cache. If Redis is not running or connection fails, the server will often hang indefinitely on startup.
    *   *Solution:* Ensure Redis is running (`docker ps`) or `redis-server` is up.
2.  **Database Connection:** Ensure Postgres is accessible. `npm run diagnose` (if available) or check `medusa-config.ts` for database URL.
3.  **Type-Checking:** V2 is TypeScript-first. Compilation errors can cause "silent failures" or restart loops. Run `npm run typecheck` to verify.

## 4. Commands (Use These)

*   **Start Dev:** `npm run dev` (Runs `medusa develop` - watch mode)
*   **Start Prod:** `npm run start` (Runs `medusa start`)
*   **Build:** `npm run build`
*   **Generate Migrations:** `npx medusa db:generate` (for DML changes)
*   **Run Migrations:** `npx medusa db:migrate`

## 5. Typical "AI Hallucinations" to AVOID

*   ❌ `import { ProductService } ...` (V1 service injection) -> ✅ Use Module links or `Query` API.
*   ❌ `src/services/my-service.ts` (monolith style) -> ✅ `src/modules/my-module/service.ts`.
*   ❌ `router.use("/store/..." ...)` -> ✅ `src/api/store/.../route.ts`.

## 6. Official Documentation
*   Refer to **Medusa v2 Documentation** (docs.medusajs.com).
*   Ignore results from 2023 or earlier (V1 era).

---
**INSTRUCTION FOR AI:**
When asked to fix or build in this repo, **ALWAYS** check `src/api` examples (like `src/api/health/route.ts`) to match the V2 syntax. Do NOT guess based on generic "Medusa" knowledge.
