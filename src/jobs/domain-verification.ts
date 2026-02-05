import { BUSINESS_MODULE } from "../modules/business"
import dns from "dns"
import { promisify } from "util"

/**
 * Job: Verify custom domain DNS records
 * 
 * Purpose:
 * - Check if CNAME/A record points to platform
 * - Update domain verification fields in database
 * - Send notification on status changes
 * 
 * Schedule: Runs every 5 minutes
 */

const dnsLookup = promisify(dns.lookup)
const dnsResolveCname = promisify(dns.resolveCname)
const dnsResolve4 = promisify(dns.resolve4)

const PLATFORM_BASE_DOMAIN = (process.env.TENANT_PLATFORM_BASE_DOMAIN || "therxspot.com")
  .trim()
  .toLowerCase()

// Optional A-record verification (only if your platform uses fixed IPs).
const PLATFORM_IPS = (process.env.PLATFORM_IPS || "").split(",").map((v) => v.trim()).filter(Boolean)

// Optional: allow verifying when a domain CNAMEs directly to Vercel.
const ALLOW_VERCEL_CNAME = (process.env.ALLOW_VERCEL_CNAME || "").toLowerCase() === "true"

export default async function domainVerificationJob(container: any) {
  const businessService = container.resolve(BUSINESS_MODULE)
  const logger = container.resolve("logger")
  
  logger.info("Starting domain verification job")
  
  try {
    // Verify only unverified domains.
    const domains = await businessService.listBusinessDomains(
      { is_verified: false },
      { take: 200, order: { created_at: "ASC" } }
    )
    
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
    const checkedAt = new Date()

    const candidate = String(domain.domain || "").trim().toLowerCase()
    if (!candidate) {
      dnsError = "Missing domain value"
    } else if (candidate.endsWith(`.${PLATFORM_BASE_DOMAIN}`) || candidate === PLATFORM_BASE_DOMAIN) {
      // Platform-managed domains are considered verified.
      isVerified = true
    }
    
    // Check CNAME record
    if (!isVerified && !dnsError) {
      try {
        const cnameRecords = await dnsResolveCname(candidate)
      
        // Check if any CNAME points into our platform base domain
        isVerified = cnameRecords.some((record) => {
          const r = String(record || "").toLowerCase()
          if (r.endsWith(`.${PLATFORM_BASE_DOMAIN}`) || r === PLATFORM_BASE_DOMAIN) return true
          if (ALLOW_VERCEL_CNAME && r.includes("vercel-dns.com")) return true
          return false
        })
      
        if (!isVerified) {
          dnsError = `CNAME does not point to ${PLATFORM_BASE_DOMAIN}`
        }
      } catch {
        // No CNAME found, try A record
        try {
          const aRecords = await dnsResolve4(candidate)
        
          if (PLATFORM_IPS.length > 0) {
            isVerified = aRecords.some((ip) => PLATFORM_IPS.includes(ip))
          
            if (!isVerified) {
              dnsError = `A record points to ${aRecords.join(", ")}, expected one of ${PLATFORM_IPS.join(", ")}`
            }
          } else {
            dnsError = "No CNAME record found (A record checks not configured)"
          }
        } catch {
          dnsError = "No valid CNAME or A record found"
        }
      }
    }
    
    if (isVerified) {
      await businessService.updateBusinessDomains(domain.id, {
        is_verified: true,
        verified_at: domain.verified_at ?? checkedAt,
        last_checked_at: checkedAt,
        dns_error: null,
      })
      
      logger.info(`Domain ${domain.domain} verified successfully`)
      await notifyDomainVerified(container, domain)
    } else {
      await businessService.updateBusinessDomains(domain.id, {
        is_verified: false,
        last_checked_at: checkedAt,
        dns_error: dnsError,
      })
      
      logger.warn(`Domain ${domain.domain} verification failed: ${dnsError}`)
      await notifyDomainError(container, domain, dnsError)
    }
  } catch (error) {
    logger.error(`Error verifying domain ${domain.domain}: ${error.message}`)
    
    await businessService.updateBusinessDomains(domain.id, {
      is_verified: false,
      last_checked_at: new Date(),
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
