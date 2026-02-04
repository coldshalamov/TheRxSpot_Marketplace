import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BUSINESS_MODULE } from "../../../../../modules/business"
import { CONSULTATION_MODULE } from "../../../../../modules/consultation"

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
  
  const body = (req.body ?? {}) as Record<string, any>

  const productId = typeof body.product_id === "string" ? body.product_id.trim() : ""
  if (!productId) {
    return res.status(400).json({
      code: "INVALID_INPUT",
      message: "product_id is required",
    })
  }

  const firstName = typeof body.customer_first_name === "string" ? body.customer_first_name.trim() : ""
  const lastName = typeof body.customer_last_name === "string" ? body.customer_last_name.trim() : ""
  const email =
    typeof body.customer_email === "string"
      ? body.customer_email.trim().toLowerCase()
      : (authContext?.actor_email ?? "").trim().toLowerCase()

  if (!firstName || !lastName || !email) {
    return res.status(400).json({
      code: "INVALID_INPUT",
      message: "customer_first_name, customer_last_name, and customer_email are required",
    })
  }

  const consultFee = body.consult_fee ?? body.consult_fee_cents ?? business?.settings?.consult_fee_cents ?? null

  try {
    const submission = await businessModuleService.createConsultSubmissions({
      business_id: business.id,
      location_id: typeof body.location_id === "string" ? body.location_id : null,
      product_id: productId,
      customer_email: email,
      customer_first_name: firstName,
      customer_last_name: lastName,
      customer_phone: typeof body.customer_phone === "string" ? body.customer_phone : null,
      customer_dob: typeof body.customer_dob === "string" ? body.customer_dob : null,
      eligibility_answers: typeof body.eligibility_answers === "object" && body.eligibility_answers ? body.eligibility_answers : {},
      consult_fee: consultFee,
      notes: typeof body.notes === "string" ? body.notes : null,
      status: "pending",
    })

    const existingPatient = await consultationService
      .getPatientByEmail(business.id, email)
      .catch(() => null)

    const patient =
      existingPatient ||
      (await consultationService.createPatients({
        business_id: business.id,
        customer_id: customerId,
        email,
        first_name: firstName,
        last_name: lastName,
        phone: typeof body.customer_phone === "string" ? body.customer_phone : null,
        date_of_birth: typeof body.customer_dob === "string" ? body.customer_dob : null,
      }))

    const consultation = await consultationService.createConsultations({
      business_id: business.id,
      patient_id: patient.id,
      clinician_id: null,
      mode: "async_form",
      status: "draft",
      chief_complaint: typeof body.chief_complaint === "string" ? body.chief_complaint : null,
      medical_history: typeof body.medical_history === "object" ? body.medical_history : null,
      notes: typeof body.notes === "string" ? body.notes : null,
      admin_notes: null,
      outcome: null,
      rejection_reason: null,
      approved_medications: [productId],
      originating_submission_id: submission.id,
      order_id: null,
    })

    const approval = await businessModuleService.createConsultApprovals({
      customer_id: customerId,
      product_id: productId,
      business_id: business.id,
      status: "pending",
      consultation_id: consultation.id,
      approved_by: null,
      approved_at: null,
      expires_at: null,
    })

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
