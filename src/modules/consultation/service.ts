import { MedusaService } from "@medusajs/framework/utils"
import { Consultation } from "./models/consultation"
import { Clinician } from "./models/clinician"
import { Patient } from "./models/patient"
import { ConsultationStatusEvent } from "./models/consultation-status-event"
import { ClinicianSchedule } from "./models/clinician-schedule"
import { ClinicianAvailabilityException } from "./models/clinician-availability-exception"
import { decryptFields, encryptFields } from "../../utils/encryption"

// Valid status transitions for consultations
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["in_progress", "cancelled", "no_show"],
  in_progress: ["completed", "incomplete", "cancelled"],
  completed: [],
  incomplete: [],
  no_show: [],
  cancelled: [],
}

// Type for availability slot
export interface AvailabilitySlot {
  day_of_week: number
  start_time: string
  end_time: string
  is_available: boolean
}

// Type for complete consultation data
export interface CompleteConsultationData {
  outcome: "approved" | "rejected" | "requires_followup"
  approved_medications?: string[]
  notes?: string
  assessment?: string
  plan?: string
  rejection_reason?: string
}

const ConsultationBaseService = MedusaService({
  Consultation,
  Clinician,
  Patient,
  ConsultationStatusEvent,
  ClinicianSchedule,
  ClinicianAvailabilityException,
}) as any

class ConsultationModuleService extends ConsultationBaseService {
  private static readonly PATIENT_PHI_FIELDS = [
    "first_name",
    "last_name",
    "email",
    "phone",
    "date_of_birth",
    "medical_history",
    "allergies",
    "medications",
    "emergency_contact_name",
    "emergency_contact_phone",
  ] as const

  private static isPhiEncryptionEnabled(): boolean {
    return (process.env.PHI_ENCRYPTION_ENABLED || "").toLowerCase() === "true"
  }

  // ==========================================
  // CONSULTATION METHODS
  // ==========================================

  async listConsultations(
    filters: Record<string, any> = {},
    options: {
      skip?: number
      take?: number
      order?: Record<string, "ASC" | "DESC">
    } = {}
  ) {
    const { skip, take, order } = options
    return await this.listConsultationsWithCount(filters, {
      skip,
      take,
      order: order || { created_at: "DESC" },
    })
  }

  async getConsultationOrThrow(id: string, relations: string[] = []) {
    const consultations = await this.listConsultationsWithCount(
      { id },
      { take: 1, relations }
    )
    if (!consultations[0].length) {
      throw new Error(`Consultation not found: ${id}`)
    }
    return consultations[0][0]
  }

  async createConsultation(data: Record<string, any>) {
    return await this.createConsultations(data)
  }

  async updateConsultation(id: string, data: Record<string, any>) {
    return await this.updateConsultations(id, data)
  }

  async deleteConsultation(id: string) {
    await this.deleteConsultations(id)
  }

  async getConsultationById(consultationId: string) {
    const consultations = await this.listConsultations(
      { id: consultationId },
      { take: 1 }
    )
    return consultations[0] ?? null
  }

  async listConsultationsByBusiness(businessId: string) {
    return await this.listConsultations(
      { business_id: businessId },
      { order: { created_at: "DESC" } }
    )
  }

  async listConsultationsByPatient(patientId: string) {
    return await this.listConsultations(
      { patient_id: patientId },
      { order: { created_at: "DESC" } }
    )
  }

  async listConsultationsByClinician(clinicianId: string) {
    return await this.listConsultations(
      { clinician_id: clinicianId },
      { order: { created_at: "DESC" } }
    )
  }

  async listConsultationsByStatus(status: string) {
    return await this.listConsultations(
      { status },
      { order: { created_at: "DESC" } }
    )
  }

  /**
   * Validate and transition consultation status
   */
  async transitionStatus(
    consultationId: string,
    newStatus: string,
    changedBy?: string,
    reason?: string
  ) {
    const consultation = await this.getConsultationById(consultationId)
    if (!consultation) {
      throw new Error(`Consultation not found: ${consultationId}`)
    }

    const currentStatus = consultation.status

    // Validate status transition
    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || []
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from "${currentStatus}" to "${newStatus}". ` +
          `Allowed transitions: ${allowedTransitions.join(", ") || "none"}`
      )
    }

    // Create status event record
    await this.createConsultationStatusEvents({
      consultation_id: consultationId,
      from_status: currentStatus,
      to_status: newStatus,
      changed_by: changedBy ?? null,
      reason: reason ?? null,
      metadata: null,
    })

    // Update consultation with new status and timestamps
    const updateData: Record<string, any> = { status: newStatus }

    if (newStatus === "in_progress") {
      updateData.started_at = new Date()
    } else if (newStatus === "completed" || newStatus === "incomplete" || newStatus === "no_show") {
      updateData.ended_at = new Date()
      if (consultation.started_at) {
        const startTime = new Date(consultation.started_at).getTime()
        const endTime = new Date().getTime()
        updateData.duration_minutes = Math.round((endTime - startTime) / (1000 * 60))
      }
    }

    return await this.updateConsultations(consultationId, updateData)
  }

  /**
   * Assign a clinician to a consultation
   */
  async assignClinician(consultationId: string, clinicianId: string) {
    const consultation = await this.getConsultationById(consultationId)
    if (!consultation) {
      throw new Error(`Consultation not found: ${consultationId}`)
    }

    const clinician = await this.getClinicianById(clinicianId)
    if (!clinician) {
      throw new Error(`Clinician not found: ${clinicianId}`)
    }

    return await this.updateConsultations(consultationId, {
      clinician_id: clinicianId,
    })
  }

  /**
   * Complete a consultation with outcome
   */
  async completeConsultation(
    consultationId: string,
    data: CompleteConsultationData,
    changedBy?: string
  ) {
    const consultation = await this.getConsultationById(consultationId)
    if (!consultation) {
      throw new Error(`Consultation not found: ${consultationId}`)
    }

    if (consultation.status !== "in_progress") {
      throw new Error(
        `Cannot complete consultation with status "${consultation.status}". Must be "in_progress".`
      )
    }

    const startedAt = consultation.started_at
    let durationMinutes: number | null = null

    if (startedAt) {
      const startTime = new Date(startedAt).getTime()
      const endTime = new Date().getTime()
      durationMinutes = Math.round((endTime - startTime) / (1000 * 60))
    }

    // Create status event record
    await this.createConsultationStatusEvents({
      consultation_id: consultationId,
      from_status: consultation.status,
      to_status: "completed",
      changed_by: changedBy ?? null,
      reason: data.notes ?? null,
      metadata: { outcome: data.outcome },
    })

    return await this.updateConsultations(consultationId, {
      status: "completed",
      ended_at: new Date(),
      duration_minutes: durationMinutes,
      outcome: data.outcome,
      notes: data.notes ?? consultation.notes,
      assessment: data.assessment ?? consultation.assessment,
      plan: data.plan ?? consultation.plan,
      approved_medications: data.approved_medications ?? consultation.approved_medications,
      rejection_reason: data.rejection_reason ?? consultation.rejection_reason,
    })
  }

  async updateConsultationStatus(
    consultationId: string,
    newStatus: string,
    changedBy?: string,
    reason?: string
  ) {
    return this.transitionStatus(consultationId, newStatus, changedBy, reason)
  }

  async startConsultation(consultationId: string) {
    return await this.transitionStatus(consultationId, "in_progress")
  }

  async cancelConsultation(consultationId: string, reason?: string, changedBy?: string) {
    return await this.transitionStatus(consultationId, "cancelled", changedBy, reason)
  }

  // ==========================================
  // CLINICIAN METHODS
  // ==========================================

  async listClinicians(
    filters: Record<string, any> = {},
    options: {
      skip?: number
      take?: number
      order?: Record<string, "ASC" | "DESC">
    } = {}
  ) {
    const { skip, take, order } = options
    return await this.listCliniciansWithCount(filters, {
      skip,
      take,
      order: order || { created_at: "DESC" },
    })
  }

  async getClinicianOrThrow(id: string) {
    const clinicians = await this.listClinicians({ id }, { take: 1 })
    if (!clinicians[0].length) {
      throw new Error(`Clinician not found: ${id}`)
    }
    return clinicians[0][0]
  }

  async createClinician(data: Record<string, any>) {
    return await this.createClinicians(data)
  }

  async updateClinician(id: string, data: Record<string, any>) {
    return await this.updateClinicians(id, data)
  }

  async deleteClinician(id: string) {
    await this.deleteClinicians(id)
  }

  async getClinicianById(clinicianId: string) {
    const clinicians = await this.listClinicians({ id: clinicianId }, { take: 1 })
    return clinicians[0] ?? null
  }

  async listActiveClinicians() {
    return await this.listClinicians(
      { status: "active" },
      { order: { created_at: "DESC" } }
    )
  }

  async listCliniciansByBusiness(businessId: string) {
    return await this.listClinicians(
      { business_id: businessId },
      { order: { created_at: "DESC" } }
    )
  }

  async getPlatformClinicians() {
    return await this.listClinicians(
      { is_platform_clinician: true, status: "active" },
      { order: { created_at: "DESC" } }
    )
  }

  /**
   * Get clinician availability schedule
   * Note: Availability is stored as JSON in clinician's metadata or separate table
   * For now, returning empty slots - implement based on your data model
   */
  async getClinicianAvailability(
    clinicianId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<AvailabilitySlot[]> {
    // This would typically query a separate availability table
    // For now, return empty array - implement based on your needs
    return []
  }

  /**
   * Set clinician availability schedule
   * Note: Implement based on your data model
   */
  async setClinicianAvailability(clinicianId: string, schedule: AvailabilitySlot[]) {
    // This would typically update a separate availability table
    // For now, just validate the clinician exists
    const clinician = await this.getClinicianById(clinicianId)
    if (!clinician) {
      throw new Error(`Clinician not found: ${clinicianId}`)
    }
    // Implement storage logic based on your data model
  }

  /**
   * Get clinician's upcoming schedule (consultations)
   */
  async getClinicianSchedule(
    clinicianId: string,
    dateFrom?: Date,
    dateTo?: Date
  ) {
    const filters: Record<string, any> = { clinician_id: clinicianId }

    if (dateFrom || dateTo) {
      filters.scheduled_at = {}
      if (dateFrom) {
        filters.scheduled_at.$gte = dateFrom
      }
      if (dateTo) {
        filters.scheduled_at.$lte = dateTo
      }
    }

    return await this.listConsultations(filters, {
      order: { scheduled_at: "ASC" },
    })
  }

  // ==========================================
  // PATIENT METHODS
  // ==========================================

  async listPatients(
    filters: Record<string, any> = {},
    options: {
      skip?: number
      take?: number
      order?: Record<string, "ASC" | "DESC">
    } = {}
  ) {
    const { skip, take, order } = options
    const [patients, count] = await this.listPatientsWithCount(filters, {
      skip,
      take,
      order: order || { created_at: "DESC" },
    })

    if (!ConsultationModuleService.isPhiEncryptionEnabled()) {
      return [patients, count] as any
    }

    const decrypted = patients.map((p) =>
      decryptFields(p as any, ConsultationModuleService.PATIENT_PHI_FIELDS as any)
    )

    return [decrypted, count] as any
  }

  async getPatientOrThrow(id: string, relations: string[] = []) {
    const patients = await this.listPatientsWithCount(
      { id },
      { take: 1, relations }
    )
    if (!patients[0].length) {
      throw new Error(`Patient not found: ${id}`)
    }

    if (!ConsultationModuleService.isPhiEncryptionEnabled()) {
      return patients[0][0]
    }

    return decryptFields(
      patients[0][0] as any,
      ConsultationModuleService.PATIENT_PHI_FIELDS as any
    ) as any
  }

  async createPatient(data: Record<string, any>) {
    if (!ConsultationModuleService.isPhiEncryptionEnabled()) {
      return await this.createPatients(data)
    }

    const encrypted = encryptFields(
      data as any,
      ConsultationModuleService.PATIENT_PHI_FIELDS as any
    )
    return await this.createPatients(encrypted)
  }

  async updatePatient(id: string, data: Record<string, any>) {
    if (!ConsultationModuleService.isPhiEncryptionEnabled()) {
      return await this.updatePatients(id, data)
    }

    const encrypted = encryptFields(
      data as any,
      ConsultationModuleService.PATIENT_PHI_FIELDS as any
    )
    return await this.updatePatients(id, encrypted)
  }

  async deletePatient(id: string) {
    await this.deletePatients(id)
  }

  async getPatientById(patientId: string) {
    const patients = await this.listPatients({ id: patientId }, { take: 1 })
    return patients[0] ?? null
  }

  async getPatientByEmail(businessId: string, email: string) {
    if (!ConsultationModuleService.isPhiEncryptionEnabled()) {
      const [patients] = await this.listPatients(
        { business_id: businessId, email },
        { take: 1 }
      )
      return patients[0] ?? null
    }

    // NOTE: If PHI encryption is enabled, `email` is stored encrypted and can't be filtered
    // using an equality query. For now, we fetch a bounded set of patients for the business
    // and match in memory after decryption.
    const [patients] = await this.listPatients(
      { business_id: businessId },
      { take: 250, order: { created_at: "DESC" } }
    )

    return (patients as any[]).find((p) => p?.email === email) ?? null
  }

  async listPatientsByBusiness(businessId: string) {
    return await this.listPatients(
      { business_id: businessId },
      { order: { created_at: "DESC" } }
    )
  }

  /**
   * Get patient consultation history
   */
  async getPatientConsultationHistory(patientId: string) {
    return await this.listConsultations(
      { patient_id: patientId },
      { order: { created_at: "DESC" } }
    )
  }

  // ==========================================
  // STATUS EVENT METHODS
  // ==========================================

  async listStatusEvents(
    filters: Record<string, any> = {},
    options: {
      skip?: number
      take?: number
      order?: Record<string, "ASC" | "DESC">
    } = {}
  ) {
    const { skip, take, order } = options
    return await this.listConsultationStatusEventsWithCount(filters, {
      skip,
      take,
      order: order || { created_at: "ASC" },
    })
  }

  async listStatusEventsByConsultation(consultationId: string) {
    return await this.listConsultationStatusEvents(
      { consultation_id: consultationId },
      { order: { created_at: "ASC" } }
    )
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Get available appointment slots for a clinician
   * This is a simplified implementation - enhance based on your needs
   */
  async getAvailableSlots(
    clinicianId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<{ date: Date; slots: string[] }[]> {
    // This would typically:
    // 1. Get clinician's availability schedule
    // 2. Get existing consultations in the date range
    // 3. Calculate available slots
    // For now, return empty structure
    return []
  }

  // ==========================================
  // CLINICIAN SCHEDULE METHODS
  // ==========================================

  async listClinicianSchedules(
    filters: Record<string, any> = {},
    options: {
      skip?: number
      take?: number
      order?: Record<string, "ASC" | "DESC">
    } = {}
  ) {
    const { skip, take, order } = options
    return await this.listClinicianSchedulesWithCount(filters, {
      skip,
      take,
      order: order || { day_of_week: "ASC" },
    })
  }

  async getClinicianSchedules(clinicianId: string) {
    return await this.listClinicianSchedules(
      { clinician_id: clinicianId },
      { order: { day_of_week: "ASC" } }
    )
  }

  async createClinicianSchedule(data: Record<string, any>) {
    return await this.createClinicianSchedules(data)
  }

  async updateClinicianSchedule(id: string, data: Record<string, any>) {
    return await this.updateClinicianSchedules(id, data)
  }

  async deleteClinicianSchedule(id: string) {
    await this.deleteClinicianSchedules(id)
  }

  // ==========================================
  // CLINICIAN AVAILABILITY EXCEPTION METHODS
  // ==========================================

  async listClinicianAvailabilityExceptions(
    filters: Record<string, any> = {},
    options: {
      skip?: number
      take?: number
      order?: Record<string, "ASC" | "DESC">
    } = {}
  ) {
    const { skip, take, order } = options
    return await this.listClinicianAvailabilityExceptionsWithCount(filters, {
      skip,
      take,
      order: order || { date: "ASC" },
    })
  }

  async getClinicianAvailabilityExceptions(clinicianId: string, startDate?: Date, endDate?: Date) {
    const filters: any = { clinician_id: clinicianId }
    
    if (startDate && endDate) {
      filters.date = {
        $gte: startDate,
        $lte: endDate,
      }
    }
    
    return await this.listClinicianAvailabilityExceptions(
      filters,
      { order: { date: "ASC" } }
    )
  }

  async createScheduleException(
    clinicianId: string,
    date: Date,
    isAvailable: boolean,
    reason?: string
  ) {
    return await this.createClinicianAvailabilityExceptions({
      clinician_id: clinicianId,
      date,
      is_available: isAvailable,
      reason: reason ?? null,
    })
  }

  async createClinicianAvailabilityException(data: Record<string, any>) {
    return await this.createClinicianAvailabilityExceptions(data)
  }

  async updateClinicianAvailabilityException(id: string, data: Record<string, any>) {
    return await this.updateClinicianAvailabilityExceptions(id, data)
  }

  async deleteClinicianAvailabilityException(id: string) {
    await this.deleteClinicianAvailabilityExceptions(id)
  }
}

export default ConsultationModuleService
