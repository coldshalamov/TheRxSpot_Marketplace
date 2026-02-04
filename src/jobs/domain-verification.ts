import { BUSINESS_MODULE } from "../modules/business"
import dns from "dns"
import { promisify } from "util"

/**
 * Job: Verify custom domain DNS records
 * 
 * Purpose:
 * - Check if CNAME/A record points to platform
 * - Update domain status in database
 * - Send notification on status changes
 * 
 * Schedule: Runs every 5 minutes
 */

const dnsLookup = promisify(dns.lookup)
const dnsResolveCname = promisify(dns.resolveCname)
const dnsResolve4 = promisify(dns.resolve4)

// Platform target domain - should be configured via environment variable
const PLATFORM_TARGET_DOMAIN = process.env.PLATFORM_TARGET_DOMAIN || "therxspot.app"
const PLATFORM_IPS = (process.env.PLATFORM_IPS || "").split(",").filter(Boolean)

export default async function domainVerificationJob(container: any) {
  const businessService = container.resolve(BUSINESS_MODULE)
  const logger = container.resolve("logger")
  
  logger.info("Starting domain verification job")
  
  try {
    // Get all domains that need verification
    // Status: pending, active, or error
    const domains = await businessService.listBusinessDomains({
      $or: [
        { status: "pending" },
        { status: "active" },
        { status: "error" },
      ],
    })
    
    if (domains.length === 0) {
      logger.info("No domains to verify")
      return
    }
    
    logger.info(`Verifying ${domains.length} domains`)
    
    for (const domain of domains) {
      await verifyDomain(container, domain)
    }
    
    logger.info(`Completed verification of ${domains.length} domains`)
  } catch (error) {
    logger.error(`Error in domain verification job: ${error.message}`)
    throw error
  }
}

/**
 * Verify a single domain's DNS configuration
 */
async function verifyDomain(container: any, domain: any) {
  const businessService = container.resolve(BUSINESS_MODULE)
  const logger = container.resolve("logger")
  
  logger.info(`Verifying domain: ${domain.domain}`)
  
  try {
    let isVerified = false
    let dnsError: string | null = null
    
    // Check CNAME record
    try {
      const cnameRecords = await dnsResolveCname(domain.domain)
      
      // Check if any CNAME points to our platform
      isVerified = cnameRecords.some(record => 
        record.toLowerCase().includes(PLATFORM_TARGET_DOMAIN.toLowerCase()) ||
        record.toLowerCase().endsWith(`.${PLATFORM_TARGET_DOMAIN.toLowerCase()}`)
      )
      
      if (!isVerified) {
        dnsError = `CNAME record points to ${cnameRecords[0]}, expected ${PLATFORM_TARGET_DOMAIN}`
      }
    } catch (cnameError) {
      // No CNAME found, try A record
      try {
        const aRecords = await dnsResolve4(domain.domain)
        
        if (PLATFORM_IPS.length > 0) {
          isVerified = aRecords.some(ip => PLATFORM_IPS.includes(ip))
          
          if (!isVerified) {
            dnsError = `A record points to ${aRecords.join(", ")}, expected one of ${PLATFORM_IPS.join(", ")}`
          }
        } else {
          // If no platform IPs configured, assume any A record is valid
          isVerified = aRecords.length > 0
        }
      } catch (aRecordError) {
        dnsError = "No valid CNAME or A record found"
      }
    }
    
    // Update domain status
    const previousStatus = domain.status
    
    if (isVerified) {
      await businessService.updateBusinessDomains(domain.id, {
        status: "active",
        verified_at: new Date(),
        last_verified_at: new Date(),
        dns_error: null,
      })
      
      if (previousStatus !== "active") {
        logger.info(`Domain ${domain.domain} verified successfully`)
        await notifyDomainVerified(container, domain)
      }
    } else {
      await businessService.updateBusinessDomains(domain.id, {
        status: previousStatus === "active" ? "error" : "pending",
        last_verified_at: new Date(),
        dns_error: dnsError,
      })
      
      if (previousStatus === "active") {
        logger.warn(`Domain ${domain.domain} verification failed: ${dnsError}`)
        await notifyDomainError(container, domain, dnsError)
      }
    }
  } catch (error) {
    logger.error(`Error verifying domain ${domain.domain}: ${error.message}`)
    
    await businessService.updateBusinessDomains(domain.id, {
      status: "error",
      last_verified_at: new Date(),
      dns_error: error.message,
    })
  }
}

/**
 * Send notification when domain is verified
 */
async function notifyDomainVerified(container: any, domain: any) {
  const notificationService = container.resolve("notification")
  const logger = container.resolve("logger")
  
  try {
    const businessService = container.resolve(BUSINESS_MODULE)
    const business = await businessService.retrieveBusiness(domain.business_id)
    
    if (business?.contact_email) {
      await notificationService.createNotifications({
        to: business.contact_email,
        channel: "email",
        template: "domain-verified",
        data: {
          business_name: business.name,
          domain: domain.domain,
          verified_at: new Date(),
        },
      })
    }
  } catch (error) {
    logger.error(`Failed to send domain verified notification: ${error.message}`)
  }
}

/**
 * Send notification when domain verification fails
 */
async function notifyDomainError(
  container: any,
  domain: any,
  error: string | null
) {
  const notificationService = container.resolve("notification")
  const logger = container.resolve("logger")
  
  try {
    const businessService = container.resolve(BUSINESS_MODULE)
    const business = await businessService.retrieveBusiness(domain.business_id)
    
    if (business?.contact_email) {
      await notificationService.createNotifications({
        to: business.contact_email,
        channel: "email",
        template: "domain-verification-failed",
        data: {
          business_name: business.name,
          domain: domain.domain,
          error: error || "DNS configuration issue",
          dns_instructions: business.settings?.dns_instructions || [],
        },
      })
    }
  } catch (err) {
    logger.error(`Failed to send domain error notification: ${err.message}`)
  }
}

/**
 * Job configuration
 */
export const config = {
  name: "verify-custom-domains",
  schedule: "*/5 * * * *", // Every 5 minutes
}
