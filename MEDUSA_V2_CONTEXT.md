# MEDUSA V2.13.1 DEVELOPER CONTEXT ("HARD MODE")

> **FOR AI AGENTS:** This document contains authoritative context on Medusa v2.13.1. You MUST assume all generic knowledge you have about "Medusa" is outdated (V1) and incorrect for this project. Use the patterns defined here.

## 1. THE GOLDEN RULES OF V2
1.  **Strict Module Isolation:** Modules (Product, Cart, Region) share NO memory space. They cannot import each other's services. They talk via **Workflows** or **Link Modules**.
2.  **Redis is Mandatory:** The v2 Event Bus uses Redis. If Redis is down, the server HANGS on startup. **Check Docker.**
3.  **No `src/services`:** The Monolithic Service pattern is dead. Logic lives in **Modules** (`src/modules`) or **Workflows** (`src/workflows`).
4.  **Next.js-style API:** Routes live in `src/api` and export `{ GET, POST }` functions, NOT Express routers.

---

## 2. KEY ARCHITECTURE & PATTERNS

### A. API Routes (The V2 Way)
*   **Path:** `src/api/store/hello-world/route.ts` -> `GET /store/hello-world`
*   **Syntax:**
    ```typescript
    import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
    import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

    export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
      // 1. Resolve Services via Container (scope)
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      
      // 2. Use Query to fetch data (Cross-Module)
      const { data: products } = await query.graph({
        entity: "product",
        fields: ["id", "title", "variants.id"]
      })

      // 3. Invoke Workflows for Actions (Write Operations)
      // const myWorkflow = myWorkflowFn(req.scope)
      // const { result } = await myWorkflow.run({ input: { ... } })

      res.json({ products })
    }
    ```

### B. Workflows (Replacing Service Chaining)
*   **Concept:** Instead of `CartService` calling `ProductService`, you define a **Workflow**.
*   **Path:** `src/workflows/my-workflow.ts`
*   **Syntax:**
    ```typescript
    import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
    import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

    // 1. Define Atomic Step
    const step1 = createStep("step-1", async (input, { container }) => {
      const myModule = container.resolve("myModuleService")
      const result = await myModule.doSomething(input)
      return new StepResponse(result, input) // Result + Compensating Data
    })

    // 2. Compose Workflow
    export const myWorkflow = createWorkflow("my-workflow", (input) => {
      const step1Result = step1(input)
      return new WorkflowResponse(step1Result)
    })
    ```

### C. Modules (Custom Logic)
*   **Path:** `src/modules/my-module`
*   **Definition:** Defined in `medusa-config.ts`.
*   **Service:** `service.ts` extends `MedusaService` (or `ModuleService`).
*   **Injection:** You can only inject things defined within the module, plus the generic `Logger`. NO cross-module injection.

### D. Middleware
*   **Path:** `src/api/middlewares.ts`
*   **Syntax:** `defineMiddlewares({ routes: [ ... ] })`.
*   **Note:** See existing file for `matcher` syntax and `requestContextMiddleware`.

---

## 3. TROUBLESHOOTING & HANGING

### "The Server is Hanging on Startup" (Indefinite Loading)
*   **CAUSE #1:** Redis is not reachable. V2's Event Bus waits for Redis.
    *   **FIX:** Run `docker-compose up -d redis`. Check `.env` for `REDIS_URL`.
*   **CAUSE #2:** Database Lock/Connection.
    *   **FIX:** Check `.env` `DATABASE_URL`. Run `npm run diagnose` (if script exists) or `npx medusa db:migrate` to ensure schema is fresh.

### "I can't find `ProductService`" / "Injection Error"
*   **CAUSE:** You are trying to import a V1 service or inject a module service where it doesn't belong.
*   **FIX:** Use `req.scope.resolve("productModuleService")` (if registered) OR preferably use `Query` (`container.resolve("query")`) to fetch data.

### "Route 404s"
*   **CAUSE:** You used `export default function` (V1/Express) instead of `export const GET` (V2).
*   **FIX:** Check `src/api/.../route.ts` exports.

---

## 4. MIGRATION CHEAT SHEET (V1 -> V2)

| V1 Concept | V2 Replacement |
| :--- | :--- |
| `src/api/index.ts` (Express Router) | `src/api/.../route.ts` (File-system routing) |
| `src/services/` (Monolithic) | `src/modules/` (Isolated) |
| `ProductService.list()` | `Query.graph({ entity: "product" })` |
| `CartService.addLineItem()` | `addToCartWorkflow.run()` |
| `EventBusService.emit()` | `eventBus.emit()` (Redesigned) |
| Plugins | Modules |

---

## 5. RELEVANT FILE PATHS IN THIS REPO
*   **Config:** `medusa-config.ts` (Module definitions)
*   **Env:** `.env` (Redis/DB URLs)
*   **API:** `src/api`
*   **Modules:** `src/modules`
*   **Workflows:** `src/workflows`
