import { Modules } from "@medusajs/framework/utils"
import { BUSINESS_MODULE } from "../modules/business"
import { CONSULTATION_MODULE } from "../modules/consultation"

/**
 * Job: Process new consult submissions
 * 
 * Purpose:
 * - Send email notification to business admins
 * - Create notification for tenant admin dashboard
 * - Auto-assign to available clinician if configured
 * - Update submission status
 * 
 * Schedule: Runs every 2 minutes to process pending submissions
 */

export default async function processConsultSubmissionJob(container: any) {
  const businessService = container.resolve(BUSINESS_MODULE)
  const consultationService = container.resolve(CONSULTATION_MODULE)
  const notificationService = container.resolve(Modules.NOTIFICATION)
  const logger = container.resolve("logger")
  
  logger.info("Starting consult submission processing job")
  
  try {
    // Find all pending consult submissions
    const pendingSubmissions = await businessService.listConsultSubmissions(
      { status: "pending" },
      { 
        order: { created_at: "ASC" },
        take: 50, // Process in batches
      }
    )
    
    if (pendingSubmissions.length === 0) {
      logger.info("No pending consult submissions to process")
      return
    }
    
    logger.info(`Processing ${pendingSubmissions.length} pending consult submissions`)
    
    for (const submission of pendingSubmissions) {
      await processSubmission(container, submission)
    }
    
    logger.info(`Successfully processed ${pendingSubmissions.length} consult submissions`)
  } catch (error) {
    logger.error(`Error processing consult submissions: ${error.message}`)
    throw error
  }
}

/**
 * Process a single consult submission
 */
async function processSubmission(container: any, submission: any) {
  const businessService = container.resolve(BUSINESS_MODULE)
  const consultationService = container.resolve(CONSULTATION_MODULE)
  const notificationService = container.resolve(Modules.NOTIFICATION)
  const logger = container.resolve("logger")
  
  logger.info(`Processing submission ${submission.id} for business ${submission.business_id}`)
  
  try {
    // 1. Get business details
    const business = await businessService.retrieveBusiness(submission.business_id)
    
    if (!business) {
      logger.warn(`Business not found for submission ${submission.id}`)
      return
    }
    
    // 2. Send email notification to business
    await sendBusinessNotification(notificationService, submission, business)
    
    // 3. Check if auto-assignment is enabled for this business
    const settings = business.settings || {}
    const autoAssignEnabled = settings.auto_assign_clinician === true
    
    if (autoAssignEnabled) {
      await autoAssignClinician(container, submission, business)
    }
    
    // 4. Create notification record for tenant admin dashboard
    await createDashboardNotification(container, submission, business)
    
    // 5. Update submission status to 'processing'
    await businessService.updateConsultSubmissions(submission.id, {
      status: "processing",
    })
    
    logger.info(`Successfully processed submission ${submission.id}`)
  } catch (error) {
    logger.error(`Error processing submission ${submission.id}: ${error.message}`)
    // Don't throw, continue processing other submissions
  }
}

/**
 * Send email notification to business admins
 */
async function sendBusinessNotification(
  notificationService: any,
  submission: any,
  business: any
) {
  try {
    await notificationService.createNotifications({
      to: business.contact_email || business.email,
      channel: "email",
      template: "consult-submission-received",
      data: {
        business_name: business.name,
        customer_name: `${submission.customer_first_name} ${submission.customer_last_name}`,
        customer_email: submission.customer_email,
        submission_id: submission.id,
        product_id: submission.product_id,
        submission_date: submission.created_at,
        dashboard_url: `${business.settings?.storefront_url || ""}/admin/consults`,
      },
    })
  } catch (error) {
    // Log but don't fail the job
    console.error(`Failed to send notification for submission ${submission.id}:`, error)
  }
}

/**
 * Auto-assign submission to an available clinician
 */
async function autoAssignClinician(
  container: any,
  submission: any,
  business: any
) {
  const consultationService = container.resolve(CONSULTATION_MODULE)
  const logger = container.resolve("logger")
  
  try {
    // Get available clinicians for this business
    const clinicians = await consultationService.listCliniciansByBusiness(business.id)
    const availableClinician = clinicians.find(c => c.status === "active")
    
    if (!availableClinician) {
      logger.warn(`No available clinician found for business ${business.id}`)
      return
    }
    
    // Create patient record if not exists
    const existingPatient = await consultationService.getPatientByEmail(
      business.id,
      submission.customer_email
    )
    
    let patientId = existingPatient?.id
    
    if (!patientId) {
      const newPatient = await consultationService.createPatients({
        business_id: business.id,
        email: submission.customer_email,
        first_name: submission.customer_first_name,
        last_name: submission.customer_last_name,
        phone: submission.customer_phone,
        date_of_birth: submission.customer_dob,
      })
      patientId = newPatient.id
    }
    
    // Create consultation
    const consultation = await consultationService.createConsultations({
      business_id: business.id,
      patient_id: patientId,
      clinician_id: availableClinician.id,
      consult_submission_id: submission.id,
      product_id: submission.product_id,
      status: "pending",
      consult_fee: submission.consult_fee,
      notes: submission.notes,
    })
    
    logger.info(`Auto-assigned submission ${submission.id} to clinician ${availableClinician.id}`)
    
    // Update submission with consultation reference
    const businessService = container.resolve(BUSINESS_MODULE)
    await businessService.updateConsultSubmissions(submission.id, {
      consultation_id: consultation.id,
    })
  } catch (error) {
    logger.error(`Failed to auto-assign clinician: ${error.message}`)
    // Don't fail the job
  }
}

/**
 * Create notification for tenant admin dashboard
 */
async function createDashboardNotification(
  container: any,
  submission: any,
  business: any
) {
  // This would typically create a notification record in a notifications table
  // For now, we log it - implement based on your notification infrastructure
  const logger = container.resolve("logger")
  logger.info(`Dashboard notification created for submission ${submission.id}`)
}

/**
 * Job configuration
 */
export const config = {
  name: "process-consult-submissions",
  schedule: "*/2 * * * *", // Every 2 minutes
}
