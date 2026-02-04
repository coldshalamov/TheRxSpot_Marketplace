/**
 * Test Data Factories
 * 
 * Factory functions to create test data for integration tests.
 * Follows the factory pattern for creating consistent test entities.
 */

import { MedusaContainer } from "@medusajs/framework/types"
import { generateTestId, dateOffset, getServices } from "./test-server"

// ============================================================================
// Business Factory
// ============================================================================

export interface BusinessOverrides {
  id?: string
  name?: string
  slug?: string
  status?: "pending" | "approved" | "active" | "suspended"
  is_active?: boolean
  domain?: string
  sales_channel_id?: string
  publishable_api_key_id?: string
  branding_config?: Record<string, any>
  settings?: Record<string, any>
}

export async function createTestBusiness(
  container: MedusaContainer,
  overrides: BusinessOverrides = {}
) {
  const { business } = getServices(container)
  
  const id = overrides.id || generateTestId("bus")
  const name = overrides.name || `Test Business ${id}`
  const slug = overrides.slug || `test-business-${id}`
  
  return await business.createBusinesses({
    id,
    name,
    slug,
    status: overrides.status || "active",
    is_active: overrides.is_active !== undefined ? overrides.is_active : true,
    domain: overrides.domain || null,
    sales_channel_id: overrides.sales_channel_id || null,
    publishable_api_key_id: overrides.publishable_api_key_id || null,
    branding_config: overrides.branding_config || {},
    settings: overrides.settings || {},
    domain_config: {},
    catalog_config: {},
  })
}

// ============================================================================
// Customer Factory
// ============================================================================

export interface CustomerOverrides {
  id?: string
  email?: string
  first_name?: string
  last_name?: string
  phone?: string
  has_account?: boolean
  metadata?: Record<string, any>
}

export async function createTestCustomer(
  container: MedusaContainer,
  overrides: CustomerOverrides = {}
) {
  const { customer } = getServices(container)
  
  const id = overrides.id || generateTestId("cust")
  
  return await customer.createCustomers({
    id,
    email: overrides.email || `customer_${id}@test.com`,
    first_name: overrides.first_name || "Test",
    last_name: overrides.last_name || "Customer",
    phone: overrides.phone || null,
    has_account: overrides.has_account !== undefined ? overrides.has_account : true,
    metadata: overrides.metadata || {},
  })
}

// ============================================================================
// Product Factory
// ============================================================================

export interface ProductOverrides {
  id?: string
  title?: string
  handle?: string
  status?: "draft" | "proposed" | "published" | "rejected"
  requires_consult?: boolean
  metadata?: Record<string, any>
}

export async function createTestProduct(
  container: MedusaContainer,
  requiresConsult: boolean = false,
  overrides: ProductOverrides = {}
) {
  const { product } = getServices(container)
  
  const id = overrides.id || generateTestId("prod")
  const title = overrides.title || `Test Product ${id}`
  const safeHandleId = id.replace(/[^a-zA-Z0-9-]/g, "-")
  
  return await product.createProducts({
    id,
    title,
    handle: overrides.handle || `test-product-${safeHandleId}`,
    status: overrides.status || "published",
    metadata: {
      ...overrides.metadata,
      requires_consult: requiresConsult,
    },
  })
}

// ============================================================================
// Clinician Factory
// ============================================================================

export interface ClinicianOverrides {
  id?: string
  business_id?: string
  user_id?: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  npi_number?: string
  license_number?: string
  license_state?: string
  license_expiry?: Date
  credentials?: string[]
  specializations?: string[]
  status?: "active" | "inactive" | "suspended"
  is_platform_clinician?: boolean
  timezone?: string
}

export async function createTestClinician(
  container: MedusaContainer,
  overrides: ClinicianOverrides = {}
) {
  const { consultation } = getServices(container)
  
  const id = overrides.id || generateTestId("clin")
  
  return await consultation.createClinicians({
    id,
    business_id: overrides.business_id || null,
    user_id: overrides.user_id || null,
    first_name: overrides.first_name || "Test",
    last_name: overrides.last_name || "Clinician",
    email: overrides.email || `clinician_${id}@test.com`,
    phone: overrides.phone || null,
    npi_number: overrides.npi_number || null,
    license_number: overrides.license_number || `LIC${id}`,
    license_state: overrides.license_state || "CA",
    license_expiry: overrides.license_expiry || dateOffset(365),
    credentials: overrides.credentials || ["MD"],
    specializations: overrides.specializations || ["General Practice"],
    status: overrides.status || "active",
    is_platform_clinician: overrides.is_platform_clinician !== undefined 
      ? overrides.is_platform_clinician 
      : false,
    timezone: overrides.timezone || "America/Los_Angeles",
  })
}

// ============================================================================
// Patient Factory
// ============================================================================

export interface PatientOverrides {
  id?: string
  business_id: string
  customer_id?: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  date_of_birth?: Date
  gender?: string
  medical_history?: Record<string, any>
  allergies?: string[]
  medications?: string[]
  emergency_contact_name?: string
  emergency_contact_phone?: string
}

export async function createTestPatient(
  container: MedusaContainer,
  overrides: PatientOverrides
) {
  const { consultation } = getServices(container)
  
  const id = overrides.id || generateTestId("pat")
  
  if (!overrides.business_id) {
    throw new Error("business_id is required to create a patient")
  }
  
  return await consultation.createPatients({
    id,
    business_id: overrides.business_id,
    customer_id: overrides.customer_id || null,
    first_name: overrides.first_name || "Test",
    last_name: overrides.last_name || "Patient",
    email: overrides.email || `patient_${id}@test.com`,
    phone: overrides.phone || null,
    date_of_birth: overrides.date_of_birth || null,
    gender: overrides.gender || null,
    medical_history: overrides.medical_history || null,
    allergies: overrides.allergies || null,
    medications: overrides.medications || null,
    emergency_contact_name: overrides.emergency_contact_name || null,
    emergency_contact_phone: overrides.emergency_contact_phone || null,
  })
}

// ============================================================================
// Consultation Factory
// ============================================================================

export type ConsultationStatus = 
  | "draft" 
  | "scheduled" 
  | "in_progress" 
  | "completed" 
  | "incomplete" 
  | "no_show" 
  | "cancelled"

export interface ConsultationOverrides {
  id?: string
  business_id: string
  patient_id: string
  clinician_id?: string
  mode?: "async_form" | "video" | "phone" | "chat"
  status?: ConsultationStatus
  scheduled_at?: Date
  started_at?: Date
  ended_at?: Date
  duration_minutes?: number
  chief_complaint?: string
  medical_history?: Record<string, any>
  assessment?: string
  plan?: string
  notes?: string
  outcome?: "approved" | "rejected" | "pending" | "requires_followup" | null
  rejection_reason?: string
  approved_medications?: string[]
  originating_submission_id?: string
  order_id?: string
}

export async function createTestConsultation(
  container: MedusaContainer,
  status: ConsultationStatus = "draft",
  overrides: ConsultationOverrides
) {
  const { consultation } = getServices(container)
  
  const id = overrides.id || generateTestId("consult")
  
  if (!overrides.business_id) {
    throw new Error("business_id is required to create a consultation")
  }
  if (!overrides.patient_id) {
    throw new Error("patient_id is required to create a consultation")
  }
  
  return await consultation.createConsultations({
    id,
    business_id: overrides.business_id,
    patient_id: overrides.patient_id,
    clinician_id: overrides.clinician_id || null,
    mode: overrides.mode || "async_form",
    status,
    scheduled_at: overrides.scheduled_at || null,
    started_at: overrides.started_at || null,
    ended_at: overrides.ended_at || null,
    duration_minutes: overrides.duration_minutes || null,
    chief_complaint: overrides.chief_complaint || null,
    medical_history: overrides.medical_history || null,
    assessment: overrides.assessment || null,
    plan: overrides.plan || null,
    notes: overrides.notes || null,
    outcome: overrides.outcome || null,
    rejection_reason: overrides.rejection_reason || null,
    approved_medications: overrides.approved_medications || null,
    originating_submission_id: overrides.originating_submission_id || null,
    order_id: overrides.order_id || null,
  })
}

// ============================================================================
// Consult Approval Factory
// ============================================================================

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired"

export interface ConsultApprovalOverrides {
  id?: string
  customer_id: string
  product_id: string
  business_id: string
  status?: ApprovalStatus
  consultation_id?: string
  approved_by?: string
  approved_at?: Date
  expires_at?: Date
}

export async function createTestConsultApproval(
  container: MedusaContainer,
  status: ApprovalStatus = "approved",
  overrides: ConsultApprovalOverrides
) {
  const { business } = getServices(container)
  
  const id = overrides.id || generateTestId("approval")
  
  if (!overrides.customer_id) {
    throw new Error("customer_id is required to create a consult approval")
  }
  if (!overrides.product_id) {
    throw new Error("product_id is required to create a consult approval")
  }
  if (!overrides.business_id) {
    throw new Error("business_id is required to create a consult approval")
  }
  
  return await business.createConsultApprovals({
    id,
    customer_id: overrides.customer_id,
    product_id: overrides.product_id,
    business_id: overrides.business_id,
    status,
    consultation_id: overrides.consultation_id || null,
    approved_by: overrides.approved_by || null,
    approved_at: status === "approved" ? (overrides.approved_at || new Date()) : null,
    expires_at: overrides.expires_at || null,
  })
}

// ============================================================================
// Order Factory
// ============================================================================

export type OrderStatus = 
  | "pending" 
  | "consult_pending" 
  | "consult_complete" 
  | "consult_rejected"
  | "payment_captured"
  | "processing"
  | "fulfilled"
  | "delivered"
  | "cancelled"
  | "refunded"

export interface OrderItemInput {
  id?: string
  title?: string
  quantity?: number
  unit_price?: number
  total?: number
  product_id?: string
  variant_id?: string
}

export interface OrderOverrides {
  id?: string
  customer_id?: string
  business_id?: string
  status?: OrderStatus
  total?: number
  currency_code?: string
  items?: OrderItemInput[]
  metadata?: Record<string, any>
}

export async function createTestOrder(
  container: MedusaContainer,
  status: OrderStatus = "pending",
  overrides: OrderOverrides = {}
) {
  const { order } = getServices(container)
  
  const id = overrides.id || generateTestId("order")
  const total = overrides.total || 100
  
  // Create order with items
  const orderData: any = {
    id,
    customer_id: overrides.customer_id || null,
    status,
    total,
    currency_code: overrides.currency_code || "usd",
    metadata: {
      ...overrides.metadata,
      business_id: overrides.business_id,
    },
  }
  
  // Add items if provided
  if (overrides.items && overrides.items.length > 0) {
    orderData.items = overrides.items.map((item, index) => ({
      id: item.id || `${id}_item_${index}`,
      title: item.title || `Item ${index + 1}`,
      quantity: item.quantity || 1,
      unit_price: item.unit_price || 10,
      total: item.total || (item.unit_price || 10) * (item.quantity || 1),
      product_id: item.product_id || null,
      variant_id: item.variant_id || null,
    }))
  }
  
  return await order.createOrders(orderData)
}

// ============================================================================
// Earning Entry Factory
// ============================================================================

export type EarningStatus = "pending" | "available" | "paid_out" | "paid" | "reversed"
export type EarningType = 
  | "product_sale" 
  | "consultation_fee" 
  | "shipping_fee" 
  | "platform_fee" 
  | "clinician_fee"

export interface EarningEntryOverrides {
  id?: string
  business_id: string
  order_id?: string
  line_item_id?: string
  consultation_id?: string
  type?: EarningType
  description?: string
  gross_amount?: number
  platform_fee?: number
  payment_processing_fee?: number
  net_amount?: number
  clinician_fee?: number
  status?: EarningStatus
  available_at?: Date
  paid_at?: Date
  payout_id?: string
  metadata?: Record<string, any>
}

export async function createTestEarningEntry(
  container: MedusaContainer,
  status: EarningStatus = "pending",
  overrides: EarningEntryOverrides
) {
  const { financials } = getServices(container)
  
  const id = overrides.id || generateTestId("earn")
  
  if (!overrides.business_id) {
    throw new Error("business_id is required to create an earning entry")
  }
  
  const grossAmount = overrides.gross_amount || 10000 // $100 in cents
  const platformFee = overrides.platform_fee || Math.round(grossAmount * 0.10)
  const processingFee = overrides.payment_processing_fee || Math.round(grossAmount * 0.029 + 30)
  const netAmount = overrides.net_amount || (grossAmount - platformFee - processingFee)
  
  return await financials.createEarningEntries({
    id,
    business_id: overrides.business_id,
    order_id: overrides.order_id || null,
    line_item_id: overrides.line_item_id || null,
    consultation_id: overrides.consultation_id || null,
    type: overrides.type || "product_sale",
    description: overrides.description || `Earning entry ${id}`,
    gross_amount: grossAmount,
    platform_fee: platformFee,
    payment_processing_fee: processingFee,
    net_amount: netAmount,
    clinician_fee: overrides.clinician_fee || null,
    status,
    available_at: status === "available" || status === "paid_out" || status === "paid"
      ? (overrides.available_at || new Date()) 
      : null,
    paid_at: status === "paid" ? (overrides.paid_at || new Date()) : null,
    payout_id: overrides.payout_id || null,
    metadata: overrides.metadata || {},
  })
}

// ============================================================================
// Payout Factory
// ============================================================================

export type PayoutStatus = "pending" | "processing" | "completed" | "failed"
export type PayoutMethod = "ach" | "wire" | "check" | "stripe_connect"

export interface PayoutOverrides {
  id?: string
  business_id: string
  total_amount?: number
  fee_amount?: number
  net_amount?: number
  status?: PayoutStatus
  method?: PayoutMethod
  destination_account?: string
  requested_at?: Date
  processed_at?: Date
  completed_at?: Date
  transaction_id?: string
  failure_reason?: string
  earning_entries?: string[]
  metadata?: Record<string, any>
}

export async function createTestPayout(
  container: MedusaContainer,
  status: PayoutStatus = "pending",
  overrides: PayoutOverrides
) {
  const { financials } = getServices(container)
  
  const id = overrides.id || generateTestId("payout")
  
  if (!overrides.business_id) {
    throw new Error("business_id is required to create a payout")
  }
  
  const totalAmount = overrides.total_amount || 9000 // $90 in cents
  const feeAmount = overrides.fee_amount || 1000 // $10 in fees
  const netAmount = overrides.net_amount || (totalAmount - feeAmount)
  
  return await financials.createPayouts({
    id,
    business_id: overrides.business_id,
    total_amount: totalAmount,
    fee_amount: feeAmount,
    net_amount: netAmount,
    status,
    method: overrides.method || "stripe_connect",
    destination_account: overrides.destination_account || null,
    requested_at: overrides.requested_at || new Date(),
    processed_at: status === "processing" || status === "completed" 
      ? (overrides.processed_at || new Date()) 
      : null,
    completed_at: status === "completed" ? (overrides.completed_at || new Date()) : null,
    transaction_id: status === "completed" ? (overrides.transaction_id || `tr_${id}`) : null,
    failure_reason: status === "failed" ? (overrides.failure_reason || "Test failure") : null,
    earning_entries: overrides.earning_entries || [],
    metadata: overrides.metadata || {},
  })
}

// ============================================================================
// Document Factory
// ============================================================================

export type DocumentType = 
  | "prescription" 
  | "lab_result" 
  | "medical_record" 
  | "consent_form" 
  | "id_verification" 
  | "insurance_card" 
  | "other"

export type StorageProvider = "s3" | "gcs" | "azure" | "local"
export type AccessLevel = "patient_only" | "clinician" | "business_staff" | "platform_admin"

export interface DocumentOverrides {
  id?: string
  business_id: string
  patient_id: string
  consultation_id?: string
  order_id?: string
  uploaded_by: string
  type?: DocumentType
  title?: string
  description?: string
  storage_provider?: StorageProvider
  storage_bucket?: string
  storage_key?: string
  file_name?: string
  file_size?: number
  mime_type?: string
  checksum?: string
  encryption_key_id?: string
  is_encrypted?: boolean
  access_level?: AccessLevel
  expires_at?: Date
  download_count?: number
  last_downloaded_at?: Date
  last_downloaded_by?: string
}

export async function createTestDocument(
  container: MedusaContainer,
  overrides: DocumentOverrides
) {
  const { compliance } = getServices(container)
  
  const id = overrides.id || generateTestId("doc")
  
  if (!overrides.business_id) {
    throw new Error("business_id is required to create a document")
  }
  if (!overrides.patient_id) {
    throw new Error("patient_id is required to create a document")
  }
  if (!overrides.uploaded_by) {
    throw new Error("uploaded_by is required to create a document")
  }
  
  return await compliance.createDocuments({
    id,
    business_id: overrides.business_id,
    patient_id: overrides.patient_id,
    consultation_id: overrides.consultation_id || null,
    order_id: overrides.order_id || null,
    uploaded_by: overrides.uploaded_by,
    type: overrides.type || "medical_record",
    title: overrides.title || `Test Document ${id}`,
    description: overrides.description || null,
    storage_provider: overrides.storage_provider || "s3",
    storage_bucket: overrides.storage_bucket || "test-bucket",
    storage_key: overrides.storage_key || `documents/${id}.pdf`,
    file_name: overrides.file_name || `test_document_${id}.pdf`,
    file_size: overrides.file_size || 1024,
    mime_type: overrides.mime_type || "application/pdf",
    checksum: overrides.checksum || `sha256_${id}`,
    encryption_key_id: overrides.encryption_key_id || null,
    is_encrypted: overrides.is_encrypted !== undefined ? overrides.is_encrypted : false,
    access_level: overrides.access_level || "patient_only",
    expires_at: overrides.expires_at || null,
    download_count: overrides.download_count || 0,
    last_downloaded_at: overrides.last_downloaded_at || null,
    last_downloaded_by: overrides.last_downloaded_by || null,
  })
}

// ============================================================================
// Audit Log Factory
// ============================================================================

export type ActorType = "customer" | "business_user" | "clinician" | "system" | "api_key"
export type ActionType = "create" | "read" | "update" | "delete" | "download" | "login" | "logout" | "export"
export type EntityType = "consultation" | "order" | "document" | "patient" | "business" | "earning" | "payout"
export type RiskLevel = "low" | "medium" | "high" | "critical"

export interface AuditLogOverrides {
  id?: string
  actor_type?: ActorType
  actor_id: string
  actor_email?: string
  ip_address?: string
  user_agent?: string
  action?: ActionType
  entity_type?: EntityType
  entity_id: string
  business_id?: string
  consultation_id?: string
  order_id?: string
  changes?: Record<string, any>
  metadata?: Record<string, any>
  risk_level?: RiskLevel
  flagged?: boolean
  created_at?: Date
}

export async function createTestAuditLog(
  container: MedusaContainer,
  overrides: AuditLogOverrides
) {
  const { compliance } = getServices(container)
  
  const id = overrides.id || generateTestId("audit")
  
  if (!overrides.actor_id) {
    throw new Error("actor_id is required to create an audit log")
  }
  if (!overrides.entity_id) {
    throw new Error("entity_id is required to create an audit log")
  }
  
  return await compliance.createAuditLogs({
    id,
    actor_type: overrides.actor_type || "customer",
    actor_id: overrides.actor_id,
    actor_email: overrides.actor_email || null,
    ip_address: overrides.ip_address || "127.0.0.1",
    user_agent: overrides.user_agent || "Test User Agent",
    action: overrides.action || "read",
    entity_type: overrides.entity_type || "consultation",
    entity_id: overrides.entity_id,
    business_id: overrides.business_id || null,
    consultation_id: overrides.consultation_id || null,
    order_id: overrides.order_id || null,
    changes: overrides.changes || null,
    metadata: overrides.metadata || {},
    risk_level: overrides.risk_level || "low",
    flagged: overrides.flagged !== undefined ? overrides.flagged : false,
    created_at: overrides.created_at || new Date(),
  })
}

// ============================================================================
// Consult Submission Factory
// ============================================================================

export type SubmissionStatus = "pending" | "approved" | "rejected"

export interface ConsultSubmissionOverrides {
  id?: string
  business_id: string
  customer_id: string
  patient_data?: Record<string, any>
  questionnaire_responses?: Record<string, any>
  status?: SubmissionStatus
  reviewed_by?: string
  reviewed_at?: Date
  notes?: string
  order_id?: string
}

export async function createTestConsultSubmission(
  container: MedusaContainer,
  overrides: ConsultSubmissionOverrides
) {
  const { business } = getServices(container)
  
  const id = overrides.id || generateTestId("sub")
  
  if (!overrides.business_id) {
    throw new Error("business_id is required to create a consult submission")
  }
  if (!overrides.customer_id) {
    throw new Error("customer_id is required to create a consult submission")
  }
  
  return await business.createConsultSubmissions({
    id,
    business_id: overrides.business_id,
    customer_id: overrides.customer_id,
    patient_data: overrides.patient_data || {},
    questionnaire_responses: overrides.questionnaire_responses || {},
    status: overrides.status || "pending",
    reviewed_by: overrides.reviewed_by || null,
    reviewed_at: overrides.reviewed_at || null,
    notes: overrides.notes || null,
    order_id: overrides.order_id || null,
  })
}

// ============================================================================
// Order Status Event Factory
// ============================================================================

export interface OrderStatusEventOverrides {
  id?: string
  order_id: string
  from_status?: string
  to_status: string
  changed_by?: string
  reason?: string
  metadata?: Record<string, any>
}

export async function createTestOrderStatusEvent(
  container: MedusaContainer,
  overrides: OrderStatusEventOverrides
) {
  const { business } = getServices(container)
  
  const id = overrides.id || generateTestId("event")
  
  if (!overrides.order_id) {
    throw new Error("order_id is required to create an order status event")
  }
  if (!overrides.to_status) {
    throw new Error("to_status is required to create an order status event")
  }
  
  return await business.createOrderStatusEvents({
    id,
    order_id: overrides.order_id,
    from_status: overrides.from_status || "pending",
    to_status: overrides.to_status,
    changed_by: overrides.changed_by || null,
    reason: overrides.reason || null,
    metadata: overrides.metadata || null,
  })
}

// ============================================================================
// Clinician Schedule Factory
// ============================================================================

export interface ClinicianScheduleOverrides {
  id?: string
  clinician_id: string
  day_of_week: number // 0 = Sunday, 6 = Saturday
  start_time: string // HH:MM format
  end_time: string // HH:MM format
  is_available?: boolean
}

export async function createTestClinicianSchedule(
  container: MedusaContainer,
  overrides: ClinicianScheduleOverrides
) {
  const { consultation } = getServices(container)
  
  const id = overrides.id || generateTestId("sched")
  
  if (!overrides.clinician_id) {
    throw new Error("clinician_id is required to create a schedule")
  }
  if (overrides.day_of_week === undefined || overrides.day_of_week === null) {
    throw new Error("day_of_week is required to create a schedule")
  }
  if (!overrides.start_time) {
    throw new Error("start_time is required to create a schedule")
  }
  if (!overrides.end_time) {
    throw new Error("end_time is required to create a schedule")
  }
  
  return await consultation.createClinicianSchedules({
    id,
    clinician_id: overrides.clinician_id,
    day_of_week: overrides.day_of_week,
    start_time: overrides.start_time,
    end_time: overrides.end_time,
    is_available: overrides.is_available !== undefined ? overrides.is_available : true,
  })
}

// ============================================================================
// Consultation Status Event Factory
// ============================================================================

export interface ConsultationStatusEventOverrides {
  id?: string
  consultation_id: string
  from_status?: string
  to_status: string
  changed_by?: string
  reason?: string
  metadata?: Record<string, any>
}

export async function createTestConsultationStatusEvent(
  container: MedusaContainer,
  overrides: ConsultationStatusEventOverrides
) {
  const { consultation } = getServices(container)
  
  const id = overrides.id || generateTestId("cse")
  
  if (!overrides.consultation_id) {
    throw new Error("consultation_id is required to create a status event")
  }
  if (!overrides.to_status) {
    throw new Error("to_status is required to create a status event")
  }
  
  return await consultation.createConsultationStatusEvents({
    id,
    consultation_id: overrides.consultation_id,
    from_status: overrides.from_status || "draft",
    to_status: overrides.to_status,
    changed_by: overrides.changed_by || null,
    reason: overrides.reason || null,
    metadata: overrides.metadata || null,
  })
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a complete test scenario with business, clinician, patient, and consultation
 */
export async function createCompleteConsultationScenario(
  container: MedusaContainer,
  consultationStatus: ConsultationStatus = "draft"
) {
  const business = await createTestBusiness(container)
  const clinician = await createTestClinician(container, { business_id: business.id })
  const patient = await createTestPatient(container, { business_id: business.id })
  const consult = await createTestConsultation(container, consultationStatus, {
    business_id: business.id,
    patient_id: patient.id,
    clinician_id: clinician.id,
  })
  
  return {
    business,
    clinician,
    patient,
    consultation: consult,
  }
}

/**
 * Create a complete test scenario with order and earnings
 */
export async function createCompleteOrderScenario(
  container: MedusaContainer,
  orderStatus: OrderStatus = "pending",
  earningStatus: EarningStatus = "pending"
) {
  const business = await createTestBusiness(container)
  const customer = await createTestCustomer(container)
  const order = await createTestOrder(container, orderStatus, {
    business_id: business.id,
    customer_id: customer.id,
    total: 100,
  })
  
  const earning = await createTestEarningEntry(container, earningStatus, {
    business_id: business.id,
    order_id: order.id,
    gross_amount: 10000,
  })
  
  return {
    business,
    customer,
    order,
    earning,
  }
}

/**
 * Create a complete test scenario with document and patient
 */
export async function createCompleteDocumentScenario(
  container: MedusaContainer,
  accessLevel: AccessLevel = "patient_only"
) {
  const business = await createTestBusiness(container)
  const patient = await createTestPatient(container, { business_id: business.id })
  const document = await createTestDocument(container, {
    business_id: business.id,
    patient_id: patient.id,
    uploaded_by: patient.id,
    access_level: accessLevel,
  })
  
  return {
    business,
    patient,
    document,
  }
}
