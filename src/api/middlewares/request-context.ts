import { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { randomUUID } from "crypto"
import { runWithLogContext, updateLogContext } from "../../utils/logger"

function getHeader(req: MedusaRequest, name: string): string | null {
  const v = req.headers[name] as string | string[] | undefined
  if (!v) return null
  const raw = Array.isArray(v) ? v[0] : v
  return typeof raw === "string" && raw.trim() ? raw.trim() : null
}

function resolveUserId(req: MedusaRequest): string | null {
  const auth = (req as any)?.auth_context
  return (
    (typeof auth?.auth_identity_id === "string" && auth.auth_identity_id) ||
    (typeof auth?.actor_id === "string" && auth.actor_id) ||
    null
  )
}

function resolveTenantId(req: MedusaRequest): string | null {
  return (
    (req as any)?.tenant_context?.business_id ||
    (req as any)?.tenantContext?.businessId ||
    (req as any)?.context?.business?.id ||
    null
  )
}

export const requestContextMiddleware = (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const requestId = getHeader(req, "x-request-id") || randomUUID()

  res.setHeader("x-request-id", requestId)

  runWithLogContext(
    {
      request_id: requestId,
      tenant_id: resolveTenantId(req),
      user_id: resolveUserId(req),
    },
    () => next()
  )
}

export function setTenantInLogContext(req: MedusaRequest) {
  updateLogContext({ tenant_id: resolveTenantId(req) })
}

export function setUserInLogContext(req: MedusaRequest) {
  updateLogContext({ user_id: resolveUserId(req) })
}

