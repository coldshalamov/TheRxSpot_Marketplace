
"use server"

import { sdk } from "@/lib/config"
import { getAuthHeaders } from "@lib/data/cookies"
import { cookies } from "next/headers"
import { getTenantConfigFromCookie } from "@lib/tenant"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type ConsultApprovalResult =
  | {
      ok: true
      has_valid_approval: boolean
      consultation_id: string | null
      expires_at: string | null
    }
  | { ok: false; code: "UNAUTHORIZED" | "BUSINESS_CONTEXT_REQUIRED" | "INVALID_INPUT" | "INTERNAL_ERROR"; message: string }

async function getTenantHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies()
  const tenantCookie = cookieStore.get("_tenant_config")?.value
  const tenant = getTenantConfigFromCookie(tenantCookie)

  const headers: Record<string, string> = {}
  if (tenant?.business?.slug) headers["x-business-slug"] = tenant.business.slug
  if (tenant?.publishable_api_key) headers["x-publishable-api-key"] = tenant.publishable_api_key
  return headers
}

export async function checkConsultApproval(productId: string): Promise<ConsultApprovalResult> {
  const id = (productId || "").trim()
  if (!id) {
    return { ok: false, code: "INVALID_INPUT", message: "productId is required" }
  }

  const headers = {
    ...(await getAuthHeaders()),
    ...(await getTenantHeaders()),
  }

  try {
    const res = await sdk.client.fetch<any>(`/store/consultations/approvals`, {
      method: "GET",
      query: { product_id: id },
      headers,
      cache: "no-store",
    })

    return {
      ok: true,
      has_valid_approval: !!res?.has_valid_approval,
      consultation_id: res?.consultation_id ?? null,
      expires_at: res?.expires_at ?? null,
    }
  } catch (e: any) {
    const status = e?.status || e?.response?.status
    const code = e?.response?.data?.code || e?.code
    const message = e?.response?.data?.message || e?.message || "Failed to check consultation approval"

    if (status === 401 || code === "UNAUTHORIZED") {
      return { ok: false, code: "UNAUTHORIZED", message }
    }

    if (code === "BUSINESS_CONTEXT_REQUIRED") {
      return { ok: false, code: "BUSINESS_CONTEXT_REQUIRED", message }
    }

    return { ok: false, code: "INTERNAL_ERROR", message }
  }
}

export type ConsultRequestInput = {
  product_id: string
  customer_email: string
  customer_first_name: string
  customer_last_name: string
  customer_phone?: string | null
  customer_dob?: string | null
  eligibility_answers?: Record<string, any>
  consult_fee?: number | string | { value: string } | null
  notes?: string | null
  chief_complaint?: string | null
  medical_history?: Record<string, any> | null
  location_id?: string | null
}

export type ConsultRequestResult =
  | { ok: true; consultation_id: string; approval_id: string; submission_id: string }
  | { ok: false; code: string; message: string }

export async function requestConsultation(input: ConsultRequestInput): Promise<ConsultRequestResult> {
  const productId = typeof input.product_id === "string" ? input.product_id.trim() : ""
  if (!productId) {
    return { ok: false, code: "INVALID_INPUT", message: "product_id is required" }
  }

  const cookieStore = await cookies()
  const tenantCookie = cookieStore.get("_tenant_config")?.value
  const tenant = getTenantConfigFromCookie(tenantCookie)

  const businessSlug = tenant?.business?.slug
  if (!businessSlug) {
    return { ok: false, code: "BUSINESS_CONTEXT_REQUIRED", message: "Missing business context" }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await getTenantHeaders()),
    ...(await getAuthHeaders()),
  }

  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/businesses/${encodeURIComponent(businessSlug)}/consult`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...input,
        product_id: productId,
      }),
      cache: "no-store",
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        ok: false,
        code: json?.code || "CONSULT_REQUEST_FAILED",
        message: json?.message || `Request failed (${res.status})`,
      }
    }

    return {
      ok: true,
      consultation_id: json?.consultation?.id,
      approval_id: json?.approval?.id,
      submission_id: json?.submission?.id,
    }
  } catch (e: any) {
    return { ok: false, code: "NETWORK_ERROR", message: e?.message || "Failed to request consultation" }
  }
}

export async function getPatientConsultations(): Promise<any[]> {
  const headers = {
    ...(await getAuthHeaders()),
    ...(await getTenantHeaders()),
  }

  try {
    const res = await sdk.client.fetch<any>(`/store/consultations`, {
      method: "GET",
      headers,
      cache: "no-store",
    })

    return Array.isArray(res?.consultations) ? res.consultations : []
  } catch {
    return []
  }
}

export async function getConsultation(id: string): Promise<any | null> {
  const consultationId = (id || "").trim()
  if (!consultationId) return null

  const headers = {
    ...(await getAuthHeaders()),
    ...(await getTenantHeaders()),
  }

  try {
    const res = await sdk.client.fetch<any>(`/store/consultations/${encodeURIComponent(consultationId)}`, {
      method: "GET",
      headers,
      cache: "no-store",
    })

    return res?.consultation ?? null
  } catch {
    return null
  }
}
