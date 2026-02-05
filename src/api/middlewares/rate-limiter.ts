import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import Redis from "ioredis"
import { getLogger } from "../../utils/logger"

/**
 * Redis-based distributed rate limiter for Medusa API endpoints
 * 
 * Replaces in-memory Map with Redis for horizontal scaling support.
 * Uses sorted sets with sliding window algorithm for accurate rate limiting.
 * 
 * Configuration:
 * - windowMs: Time window in milliseconds
 * - maxRequests: Maximum requests per window
 * 
 * Environment Variables:
 * - REDIS_URL: Redis connection URL (required for production)
 */

// Redis client singleton
let redisClient: Redis | null = null

function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379"
    redisClient = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      maxRetriesPerRequest: 3,
    })
    
    redisClient.on("error", (err) => {
      const logger = getLogger()
      logger.error({ error: err }, "rate-limiter: redis client error")
    })
  }
  return redisClient
}

// Default configuration
const DEFAULT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const DEFAULT_MAX_REQUESTS = 100

interface RateLimiterOptions {
  windowMs?: number
  maxRequests?: number
  keyPrefix?: string
  keyGenerator?: (req: MedusaRequest) => string
  skipSuccessfulRequests?: boolean
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
}

/**
 * Check rate limit using Redis sliding window algorithm
 * Uses sorted sets to track request timestamps
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const redis = getRedisClient()
  const now = Date.now()
  const windowStart = now - windowMs
  const resetTime = now + windowMs

  const pipeline = redis.pipeline()
  
  // Remove entries outside the current window
  pipeline.zremrangebyscore(key, 0, windowStart)
  
  // Count current entries in window
  pipeline.zcard(key)
  
  // Add current request with unique member (timestamp + random)
  const member = `${now}-${Math.random().toString(36).substring(2, 15)}`
  pipeline.zadd(key, now, member)
  
  // Set expiration on the key
  pipeline.pexpire(key, windowMs)
  
  const results = await pipeline.exec()
  
  if (!results) {
    // If Redis fails, allow the request (fail open for availability)
    const logger = getLogger()
    logger.error("rate-limiter: redis pipeline failed")
    return { allowed: true, remaining: maxRequests, resetTime }
  }
  
  // results[1] contains the zcard result (count before adding current request)
  const count = (results[1]?.[1] as number) || 0
  const currentCount = count + 1 // Include current request
  
  return {
    allowed: currentCount <= maxRequests,
    remaining: Math.max(0, maxRequests - currentCount),
    resetTime,
  }
}

/**
 * Generate a rate limit key from the request
 * Uses IP address + optional key prefix
 */
function defaultKeyGenerator(req: MedusaRequest, prefix: string = ""): string {
  // Get client IP
  const ip = (req.headers["x-forwarded-for"] as string) || 
             (req.headers["x-real-ip"] as string) || 
             (req.socket?.remoteAddress) ||
             "unknown"
  
  const ipAddress = ip.split(",")[0].trim()
  return `rate_limit:${prefix}:${ipAddress}`
}

/**
 * Create a rate limiting middleware with custom options
 */
export function createRateLimiter(options: RateLimiterOptions = {}) {
  const {
    windowMs = DEFAULT_WINDOW_MS,
    maxRequests = DEFAULT_MAX_REQUESTS,
    keyPrefix = "",
    keyGenerator = defaultKeyGenerator,
    skipSuccessfulRequests = false,
  } = options

  return async (
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    // Integration tests run against ephemeral databases but the Redis limiter
    // uses a shared keyspace by IP/window. Disable in `test` to keep runs
    // deterministic and isolated.
    if ((process.env.NODE_ENV || "").toLowerCase() === "test") {
      return next()
    }

    const key = keyGenerator(req, keyPrefix)
    
    try {
      const result = await checkRateLimit(key, maxRequests, windowMs)
      
      // Set rate limit headers
      res.setHeader("X-RateLimit-Limit", maxRequests.toString())
      res.setHeader("X-RateLimit-Remaining", result.remaining.toString())
      res.setHeader("X-RateLimit-Reset", Math.ceil(result.resetTime / 1000).toString())
      
      // Check if limit exceeded
      if (!result.allowed) {
        const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000)
        res.setHeader("Retry-After", retryAfter.toString())
        
        return res.status(429).json({
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests, please try again later",
          retry_after: retryAfter,
        })
      }
      
      next()
    } catch (error) {
      // Log error but allow request (fail open)
      const logger = getLogger()
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "rate-limiter: error"
      )
      next()
    }
  }
}

/**
 * Pre-configured rate limiters for common use cases
 */

/**
 * Strict rate limiter for authentication endpoints
 * - 5 attempts per 15 minutes
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  keyPrefix: "auth",
})

/**
 * Rate limiter for consult submissions
 * - 3 submissions per hour per IP
 */
export const consultSubmissionRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3,
  keyPrefix: "consult",
})

/**
 * General API rate limiter
 * - 100 requests per 15 minutes
 */
export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  keyPrefix: "api",
})

/**
 * Rate limiter for customer registration
 * - 3 registrations per hour per IP
 */
export const registrationRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3,
  keyPrefix: "register",
})

/**
 * Rate limiter for password reset
 * - 3 requests per hour per IP
 */
export const passwordResetRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3,
  keyPrefix: "password-reset",
})

// Legacy exports for backward compatibility
export { getRedisClient }
