import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../modules/business"
import { provisionBusinessWorkflow } from "../../../../workflows/provision-business"
import { sha256HmacHex, normalizeHexSignature, safeEqualHex } from "../../../../utils/hmac"
import { stableStringify } from "../../../../utils/stable-json"
import { z } from "zod"

// This endpoint uses HMAC auth (Hub signature), not Medusa admin auth.
export const AUTHENTICATE = false

function normalizeHandle(input: unknown): string {
  if (typeof input !== "string") return ""
  return input.trim().toLowerCase()
}

function isValidHandle(handle: string): boolean {
  // DNS-label-ish: lowercase letters, digits, hyphen; 3-63 chars, no leading/trailing hyphen.
  if (!/^[a-z0-9-]{3,63}$/.test(handle)) return false
  if (handle.startsWith("-") || handle.endsWith("-")) return false
  return true
}

function parseTimestampMs(header: unknown): number | null {
  if (typeof header !== "string") return null
  const raw = header.trim()
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null

  // Accept seconds or milliseconds.
  if (n < 10_000_000_000) {
    return Math.trunc(n * 1000)
  }
  return Math.trunc(n)
}

function getPlatformBaseDomain(): string {
  return (process.env.TENANT_PLATFORM_BASE_DOMAIN || "therxspot.com")
    .trim()
    .toLowerCase()
}

/**
 * POST /admin/hub/provision
 *
 * Hub -> Marketplace provisioning endpoint.
 *
 * Security:
 * - Requires HMAC signature + timestamp.
 * - Signature is computed over `timestamp + "." + stableStringify(body)`.
 *
 * Required headers:
 * - X-Hub-Timestamp: unix seconds or ms
 * - X-Hub-Signature: hex or `sha256=<hex>`
 *
 * Env:
 * - HUB_PROVISIONING_SECRET (required)
 * - TENANT_PLATFORM_BASE_DOMAIN (optional, default `therxspot.com`)
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const isProd = (process.env.NODE_ENV || "").toLowerCase() === "production"
  const secret = process.env.HUB_PROVISIONING_SECRET
  if (!secret) {
    return res.status(501).json({
      code: "HUB_PROVISIONING_NOT_CONFIGURED",
      message: "HUB_PROVISIONING_SECRET is not configured on the server",
    })
  }

  const timestampHeader = req.headers["x-hub-timestamp"] as string | undefined
  const signatureHeader = req.headers["x-hub-signature"] as string | undefined

  const tsMs = parseTimestampMs(timestampHeader)
  if (!tsMs) {
    return res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Missing or invalid X-Hub-Timestamp header",
    })
  }

  const now = Date.now()
  const maxSkewMs = 5 * 60 * 1000
  if (Math.abs(now - tsMs) > maxSkewMs) {
    return res.status(401).json({
      code: "UNAUTHORIZED",
      message: "X-Hub-Timestamp is outside the allowed window",
    })
  }

  const bodyUnknown: unknown = req.body ?? {}
  const canonicalBody = stableStringify(bodyUnknown)
  const message = `${tsMs}.${canonicalBody}`

  const expected = sha256HmacHex(secret, message)
  const received = normalizeHexSignature(signatureHeader || "")

  if (!received || !safeEqualHex(received, expected)) {
    return res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Invalid X-Hub-Signature",
    })
  }

  const BodySchema = z
    .object({
      // Contract version (optional for backwards compatibility).
      schema_version: z.number().int().positive().optional(),

      // Primary identity / idempotency key for a tenant.
      handle: z.string(),

      business_name: z.string(),
      owner_email: z.string(),

      logo_url: z.string().optional(),
      primary_color: z.string().optional(),
      secondary_color: z.string().optional(),
    })
    .strict()

  const parsed = BodySchema.safeParse(bodyUnknown)
  if (!parsed.success) {
    return res.status(400).json({
      code: "INVALID_INPUT",
      message: "Invalid provisioning payload",
    })
  }

  const handle = normalizeHandle(parsed.data.handle)
  const businessName = parsed.data.business_name.trim()
  const ownerEmail = parsed.data.owner_email.trim().toLowerCase()

  if (!handle || !isValidHandle(handle)) {
    return res.status(400).json({
      code: "INVALID_INPUT",
      message: "handle must be a DNS-safe slug (3-63 chars, lowercase letters/digits/hyphen)",
    })
  }
  if (!businessName) {
    return res.status(400).json({
      code: "INVALID_INPUT",
      message: "business_name is required",
    })
  }
  if (!ownerEmail || !ownerEmail.includes("@")) {
    return res.status(400).json({
      code: "INVALID_INPUT",
      message: "owner_email is required",
    })
  }

  const platformBaseDomain = getPlatformBaseDomain()
  const platformHostname = `${handle}.${platformBaseDomain}`
  const storefrontUrl = `https://${platformHostname}`

  const businessService = req.scope.resolve(BUSINESS_MODULE) as any

  // Idempotency: treat handle/slug as the primary key for provisioning.
  const existing = await businessService.getBusinessBySlug(handle)
  if (existing) {
    // Ensure platform domain record exists (best-effort).
    try {
      const domains = await businessService.listBusinessDomains({ domain: platformHostname }, { take: 1 })
      if (!domains?.length) {
        await businessService.createBusinessDomains({
          business_id: existing.id,
          domain: platformHostname,
          is_primary: true,
          is_verified: true,
          verified_at: new Date(),
        })
      }
    } catch {
      // don't fail idempotent response
    }

    const token =
      (existing?.settings as any)?.publishable_api_key_token ?? null

    return res.json({
      business: existing,
      business_id: existing.id,
      sales_channel_id: (existing as any).sales_channel_id ?? null,
      publishable_api_key_id: (existing as any).publishable_api_key_id ?? null,
      publishable_api_key_token: token,
      storefront_url: storefrontUrl,
      idempotent: true,
    })
  }

  try {
    // Create business record (pending) then run provisioning workflow.
    let stage = "create_business"

    let business: any
    try {
      business = await businessService.createBusinesses({
        name: businessName,
        slug: handle,
        domain: platformHostname,
        status: "pending",
        is_active: true,
        contact_email: ownerEmail,
        ...(parsed.data.logo_url ? { logo_url: parsed.data.logo_url } : {}),
        ...(parsed.data.primary_color ? { primary_color: parsed.data.primary_color } : {}),
        ...(parsed.data.secondary_color ? { secondary_color: parsed.data.secondary_color } : {}),
      } as any)
    } catch (e) {
      ;(e as any).__hub_stage = stage
      throw e
    }

    stage = "provision_workflow"
    let result: any
    try {
      const r = await provisionBusinessWorkflow(req.scope).run({
        input: {
          business_id: business.id,
          storefront_base_url: storefrontUrl,
        },
      })
      result = (r as any).result ?? r
    } catch (e) {
      ;(e as any).__hub_stage = stage
      throw e
    }

    // Create/mark platform domain as primary + verified (we control DNS for *.therxspot.com).
    // Best-effort; domain is still resolvable via Business.domain fallback.
    stage = "create_business_domain"
    try {
      await businessService.createBusinessDomains({
        business_id: business.id,
        domain: platformHostname,
        is_primary: true,
        is_verified: true,
        verified_at: new Date(),
      })
    } catch {
      // ignore duplicates
    }

    return res.status(201).json({
      business: result,
      business_id: result.id,
      sales_channel_id: (result as any).sales_channel_id ?? null,
      publishable_api_key_id: (result as any).publishable_api_key_id ?? null,
      publishable_api_key_token: (result as any)?.settings?.publishable_api_key_token ?? null,
      storefront_url: storefrontUrl,
    })
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : typeof e === "object" && e && "message" in e
          ? String((e as any).message)
          : typeof e === "string"
            ? e
            : JSON.stringify(e)
    return res.status(400).json({
      code: "HUB_PROVISION_FAILED",
      message: isProd ? "Provisioning failed" : msg,
      stage: typeof e === "object" && e && "__hub_stage" in e ? (e as any).__hub_stage : undefined,
    })
  }
}
