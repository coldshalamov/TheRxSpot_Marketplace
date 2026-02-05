import { BUSINESS_MODULE } from "../modules/business"
import { CONSULTATION_MODULE } from "../modules/consultation"
import { getLogger } from "../utils/logger"

function isUniqueViolation(err: unknown): boolean {
  if (!err) return false

  if (typeof err === "object") {
    const maybeCode =
      "code" in err && typeof (err as { code?: unknown }).code === "string"
        ? (err as { code: string }).code
        : null
    if (maybeCode === "23505") return true

    const maybeType =
      "type" in err && typeof (err as { type?: unknown }).type === "string"
        ? (err as { type: string }).type
        : null
    if (maybeType === "duplicate_error") return true
  }

  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes("duplicate key value violates unique constraint") ||
    msg.toLowerCase().includes("unique constraint") ||
    msg.toLowerCase().includes("already exists")
  )
}

async function ensurePatient(container: any, input: { businessId: string; customerId?: string | null; email: string; firstName: string; lastName: string; phone?: string | null; dob?: string | null }) {
  const consultationService = container.resolve(CONSULTATION_MODULE) as any

  if (input.customerId) {
    const existingByCustomer = await consultationService
      .getPatientByCustomerId(input.businessId, input.customerId)
      .catch(() => null)
    if (existingByCustomer) return existingByCustomer
  }

  const existingByEmail = await consultationService
    .getPatientByEmail(input.businessId, input.email)
    .catch(() => null)
  if (existingByEmail) return existingByEmail

  try {
    return await consultationService.createPatient({
      business_id: input.businessId,
      customer_id: input.customerId ?? null,
      email: input.email,
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone ?? null,
      date_of_birth: input.dob ?? null,
    })
  } catch (e) {
    if (!isUniqueViolation(e)) throw e
    // Race: another worker created it.
    if (input.customerId) {
      const byCustomer = await consultationService.getPatientByCustomerId(input.businessId, input.customerId)
      if (byCustomer) return byCustomer
    }
    return await consultationService.getPatientByEmail(input.businessId, input.email)
  }
}

async function ensureConsultation(container: any, input: { businessId: string; patientId: string; submissionId: string; productId: string; chiefComplaint?: string | null; medicalHistory?: unknown; notes?: string | null }) {
  const consultationService = container.resolve(CONSULTATION_MODULE) as any

  const [existing] = await consultationService
    .listConsultations({ originating_submission_id: input.submissionId }, { take: 1 })
    .catch(() => [[], 0])

  if (existing?.[0]) return existing[0]

  try {
    return await consultationService.createConsultation({
      business_id: input.businessId,
      patient_id: input.patientId,
      clinician_id: null,
      mode: "async_form",
      status: "draft",
      chief_complaint: input.chiefComplaint ?? null,
      medical_history:
        input.medicalHistory && typeof input.medicalHistory === "object" ? input.medicalHistory : null,
      notes: input.notes ?? null,
      admin_notes: null,
      outcome: null,
      rejection_reason: null,
      approved_medications: [input.productId],
      originating_submission_id: input.submissionId,
      order_id: null,
    })
  } catch (e) {
    if (!isUniqueViolation(e)) throw e
    const [again] = await consultationService.listConsultations(
      { originating_submission_id: input.submissionId },
      { take: 1 }
    )
    if (!again?.[0]) throw e
    return again[0]
  }
}

async function ensurePendingApproval(container: any, input: { businessId: string; customerId: string; productId: string; consultationId: string }) {
  const businessService = container.resolve(BUSINESS_MODULE) as any

  const approvals = await businessService.listConsultApprovals(
    {
      business_id: input.businessId,
      customer_id: input.customerId,
      product_id: input.productId,
      status: "pending",
    },
    { take: 1, order: { created_at: "DESC" } }
  )
  const existing = approvals?.[0]
  if (existing) {
    if (!existing.consultation_id) {
      await businessService.updateConsultApprovals({
        id: existing.id,
        consultation_id: input.consultationId,
      })
      const updated = await businessService.retrieveConsultApproval(existing.id).catch(() => null)
      return updated ?? existing
    }
    return existing
  }

  try {
    return await businessService.createConsultApprovals({
      customer_id: input.customerId,
      product_id: input.productId,
      business_id: input.businessId,
      status: "pending",
      consultation_id: input.consultationId,
      approved_by: null,
      approved_at: null,
      expires_at: null,
    })
  } catch (e) {
    if (!isUniqueViolation(e)) throw e
    const approvals2 = await businessService.listConsultApprovals(
      {
        business_id: input.businessId,
        customer_id: input.customerId,
        product_id: input.productId,
        status: "pending",
      },
      { take: 1, order: { created_at: "DESC" } }
    )
    if (!approvals2?.[0]) throw e
    return approvals2[0]
  }
}

/**
 * process-consult-submission
 *
 * Week 1 ("Chaos Monkey") hardening:
 * This job is a reconciliation / repair loop that makes consult intake crash-safe.
 *
 * If the API crashed after persisting consult_submission but before creating:
 * - Patient
 * - Consultation
 * - ConsultApproval
 *
 * ...this job can be retried safely without duplicating records due to DB uniqueness guards.
 */
export default async function processConsultSubmissionJob(container: any) {
  const logger = getLogger()
  const businessService = container.resolve(BUSINESS_MODULE) as any

  const pending = await businessService.listConsultSubmissionsDecrypted(
    { status: "pending", deleted_at: null },
    { take: 100, order: { created_at: "ASC" } }
  )

  for (const submission of pending) {
    try {
      const businessId = submission.business_id as string
      const productId = submission.product_id as string
      const customerId = (typeof submission.customer_id === "string" ? submission.customer_id : "")?.trim()
      const email = (submission.customer_email || "").trim().toLowerCase()
      const firstName = (submission.customer_first_name || "").trim()
      const lastName = (submission.customer_last_name || "").trim()

      if (!businessId || !productId || !email || !firstName || !lastName) {
        logger.warn(
          { consult_submission_id: submission.id, tenant_id: businessId ?? null },
          "process-consult-submission: skipping invalid submission"
        )
        continue
      }

      if (!customerId) {
        // Without a customer_id we can still create a Patient by email, but we can't reliably link approvals
        // to a store session. Keep it conservative.
        logger.warn(
          { consult_submission_id: submission.id, tenant_id: businessId },
          "process-consult-submission: submission missing customer_id"
        )
        continue
      }

      const patient = await ensurePatient(container, {
        businessId,
        customerId,
        email,
        firstName,
        lastName,
        phone: typeof submission.customer_phone === "string" ? submission.customer_phone : null,
        dob: typeof submission.customer_dob === "string" ? submission.customer_dob : null,
      })

      const consultation = await ensureConsultation(container, {
        businessId,
        patientId: patient.id,
        submissionId: submission.id,
        productId,
        chiefComplaint: typeof submission.chief_complaint === "string" ? submission.chief_complaint : null,
        medicalHistory: submission.medical_history ?? null,
        notes: typeof submission.notes === "string" ? submission.notes : null,
      })

      await ensurePendingApproval(container, {
        businessId,
        customerId,
        productId,
        consultationId: consultation.id,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      logger.warn(
        { consult_submission_id: submission.id, error: msg },
        "process-consult-submission: failed"
      )
    }
  }
}

export const config = {
  name: "process-consult-submission",
  schedule: "*/1 * * * *", // Every minute
}
