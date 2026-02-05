import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../../modules/business"
import { CONSULTATION_MODULE } from "../../../../../modules/consultation"
import { z } from "zod"

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

function asCents(value: unknown): number {
  if (value == null) return 0
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : 0
  if (typeof value === "string") return parseInt(value, 10) || 0
  if (typeof value === "object" && value && "value" in value) {
    const v = (value as { value?: unknown }).value
    if (typeof v === "string") return parseInt(v, 10) || 0
  }
  return 0
}

const ConsultRequestSchema = z
  .object({
    product_id: z.string().min(1),
    location_id: z.string().min(1).nullable().optional(),

    customer_first_name: z.string().min(1),
    customer_last_name: z.string().min(1),
    customer_email: z.string().email(),

    customer_phone: z.string().min(1).nullable().optional(),
    customer_dob: z.string().min(1).nullable().optional(),

    eligibility_answers: z.record(z.unknown()).optional().default({}),

    consult_fee: z.unknown().optional(),
    consult_fee_cents: z.unknown().optional(),

    chief_complaint: z.string().min(1).nullable().optional(),
    medical_history: z.record(z.unknown()).nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict()

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const businessModuleService = req.scope.resolve(BUSINESS_MODULE)
  const consultationService = req.scope.resolve(CONSULTATION_MODULE) as any
  const { slug } = req.params

  const authContext = (req as any).auth_context as
    | { actor_id?: string; actor_type?: string; actor_email?: string }
    | undefined

  const customerId = authContext?.actor_type === "customer" ? authContext.actor_id : undefined
  if (!customerId) {
    return res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Sign in to request a consultation",
    })
  }
  
  const business = await businessModuleService.getBusinessBySlug(slug)
  
  if (!business) {
    return res.status(404).json({ message: "Business not found" })
  }
  
  const parsed = ConsultRequestSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({
      code: "INVALID_INPUT",
      message: "Invalid consultation request payload",
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    })
  }

  const body = parsed.data
  const productId = body.product_id.trim()
  const firstName = body.customer_first_name.trim()
  const lastName = body.customer_last_name.trim()
  const email = body.customer_email.trim().toLowerCase()

  const consultFee =
    asCents(body.consult_fee) ||
    asCents(body.consult_fee_cents) ||
    asCents((business?.settings as Record<string, unknown> | null | undefined)?.consult_fee_cents) ||
    null

  const idempotencyKey =
    typeof req.headers["idempotency-key"] === "string" ? req.headers["idempotency-key"].trim() : ""

  try {
    // Concurrency guard: only one pending approval per (business, customer, product).
    // This prevents duplicate consult requests under "50 submits at once" conditions.
    const existingApprovals = await businessModuleService.listConsultApprovals(
      {
        business_id: business.id,
        customer_id: customerId,
        product_id: productId,
        status: "pending",
      },
      { take: 1, order: { created_at: "DESC" } }
    )
    const existingApproval = existingApprovals?.[0]
    if (existingApproval?.consultation_id) {
      const consultation = await consultationService
        .getConsultationOrThrow(existingApproval.consultation_id)
        .catch(() => null)
      return res.status(200).json({
        idempotent: true,
        submission: null,
        consultation: consultation ? { id: consultation.id, status: consultation.status } : { id: existingApproval.consultation_id, status: null },
        approval: { id: existingApproval.id, status: existingApproval.status },
      })
    }

    // Idempotency (explicit): if an idempotency key is supplied, return the existing submission.
    if (idempotencyKey) {
      const existing = await businessModuleService.listConsultSubmissionsDecrypted(
        { business_id: business.id, customer_id: customerId, idempotency_key: idempotencyKey, deleted_at: null },
        { take: 1, order: { created_at: "DESC" } }
      )
      if (existing?.[0]) {
        const submission = existing[0]
        const [consultations] = await consultationService
          .listConsultations({ originating_submission_id: submission.id }, { take: 1 })
          .catch(() => [[], 0])
        const consultation = consultations?.[0] ?? null

        const approvals = await businessModuleService.listConsultApprovals(
          {
            business_id: business.id,
            customer_id: customerId,
            product_id: productId,
            status: "pending",
          },
          { take: 1, order: { created_at: "DESC" } }
        )
        const approval = approvals?.[0] ?? null

        return res.status(200).json({
          idempotent: true,
          submission,
          consultation: consultation ? { id: consultation.id, status: consultation.status } : null,
          approval: approval ? { id: approval.id, status: approval.status } : null,
        })
      }
    }

    let submission: any = null
    try {
      submission = await businessModuleService.createConsultSubmission({
        business_id: business.id,
        location_id: body.location_id ?? null,
        product_id: productId,
        customer_id: customerId,
        idempotency_key: idempotencyKey || null,
        customer_email: email,
        customer_first_name: firstName,
        customer_last_name: lastName,
        customer_phone: body.customer_phone ?? null,
        customer_dob: body.customer_dob ?? null,
        eligibility_answers: body.eligibility_answers ?? {},
        consult_fee: consultFee,
        chief_complaint: body.chief_complaint ?? null,
        medical_history: body.medical_history ?? null,
        notes: body.notes ?? null,
        status: "pending",
      })
    } catch (e) {
      if (!isUniqueViolation(e)) throw e

      // Concurrency fallback: pending submission already exists.
      const existing = await businessModuleService.listConsultSubmissionsDecrypted(
        {
          business_id: business.id,
          customer_id: customerId,
          product_id: productId,
          status: "pending",
          deleted_at: null,
        },
        { take: 1, order: { created_at: "DESC" } }
      )
      submission = existing?.[0] ?? null
      if (!submission) throw e
    }

    // Crash-safety: if the request crashes after persisting `consult_submission` but before creating
    // Patient/Consultation/Approval, the `process-consult-submission` job will reconcile it.
    // We still do the happy-path creation here for UX latency.
    const existingPatient =
      (await consultationService.getPatientByCustomerId(business.id, customerId).catch(() => null)) ||
      (await consultationService.getPatientByEmail(business.id, email).catch(() => null))

    let patient: any = existingPatient
    if (!patient) {
      try {
        patient = await consultationService.createPatient({
          business_id: business.id,
          customer_id: customerId,
          email,
          first_name: firstName,
          last_name: lastName,
          phone: body.customer_phone ?? null,
          date_of_birth: body.customer_dob ?? null,
        })
      } catch (e) {
        if (!isUniqueViolation(e)) throw e
        patient =
          (await consultationService.getPatientByCustomerId(business.id, customerId).catch(() => null)) ||
          (await consultationService.getPatientByEmail(business.id, email).catch(() => null))
        if (!patient) throw e
      }
    }

    let consultation: any = null
    const [existingConsults] = await consultationService
      .listConsultations({ originating_submission_id: submission.id }, { take: 1 })
      .catch(() => [[], 0])

    if (existingConsults?.[0]) {
      consultation = existingConsults[0]
    } else {
      try {
        consultation = await consultationService.createConsultation({
          business_id: business.id,
          patient_id: patient.id,
          clinician_id: null,
          mode: "async_form",
          status: "draft",
          chief_complaint: body.chief_complaint ?? null,
          medical_history: body.medical_history ?? null,
          notes: body.notes ?? null,
          admin_notes: null,
          outcome: null,
          rejection_reason: null,
          approved_medications: [productId],
          originating_submission_id: submission.id,
          order_id: null,
        })
      } catch (e) {
        if (!isUniqueViolation(e)) throw e
        const [again] = await consultationService.listConsultations(
          { originating_submission_id: submission.id },
          { take: 1 }
        )
        consultation = again?.[0] ?? null
        if (!consultation) throw e
      }
    }

    let approval: any = null
    try {
      approval = await businessModuleService.createConsultApprovals({
        customer_id: customerId,
        product_id: productId,
        business_id: business.id,
        status: "pending",
        consultation_id: consultation.id,
        approved_by: null,
        approved_at: null,
        expires_at: null,
      })
    } catch (e) {
      if (!isUniqueViolation(e)) throw e
      const approvals = await businessModuleService.listConsultApprovals(
        {
          customer_id: customerId,
          product_id: productId,
          business_id: business.id,
          status: "pending",
        },
        { take: 1, order: { created_at: "DESC" } }
      )
      approval = approvals?.[0] ?? null
      if (!approval) throw e
      if (!approval.consultation_id && consultation?.id) {
        await businessModuleService.updateConsultApprovals({
          id: approval.id,
          consultation_id: consultation.id,
        })
      }
    }

    return res.status(201).json({
      submission,
      consultation: { id: consultation.id, status: consultation.status },
      approval: { id: approval.id, status: approval.status },
    })
  } catch (error) {
    return res.status(400).json({
      code: "CONSULT_REQUEST_FAILED",
      message: "Failed to create consultation request",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
