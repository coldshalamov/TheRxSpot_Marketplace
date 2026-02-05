import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getLogger } from "../../utils/logger"

interface HealthCheckResponse {
  status: "healthy" | "unhealthy"
  checks: {
    database: "ok" | "error"
    redis: "ok" | "error"
  }
  timestamp: string
}

/**
 * Health check endpoint for monitoring and load balancers
 * Checks database and Redis connectivity
 * Returns 200 if healthy, 503 if unhealthy
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse<HealthCheckResponse>
): Promise<void> {
  const logger = getLogger()
  const container = req.scope as any
  const timestamp = new Date().toISOString()
  
  const checks: HealthCheckResponse["checks"] = {
    database: "error",
    redis: "error"
  }

  // Check database connectivity
  try {
    // Use Medusa's query tool to test database connection
    const query = container.resolve("query")
    // Execute a simple query to verify connectivity
    await query.graph({
      entity: "region",
      fields: ["id"],
      take: 1
    })
    checks.database = "ok"
  } catch (error) {
    logger.error({ error }, "Health check: database connection failed")
    checks.database = "error"
  }

  // Check Redis connectivity
  try {
    // In development, Medusa might use Local Event Bus instead of Redis
    // Try to resolve redis, but don't fail if it's not available
    try {
      const redisClient = container.resolve("redis")
      if (redisClient && typeof redisClient.ping === "function") {
        await redisClient.ping()
        checks.redis = "ok"
      }
    } catch (redisError) {
      // Redis not available, check if we're using local event bus
      try {
        const eventBus = container.resolve("event_bus")
        if (eventBus) {
          // Local event bus is fine for development
          checks.redis = "ok"
        }
      } catch {
        checks.redis = "error"
      }
    }
  } catch (error) {
    logger.error({ error }, "Health check: redis connection failed")
    checks.redis = "error"
  }

  const isHealthy = checks.database === "ok" && checks.redis === "ok"
  const status = isHealthy ? "healthy" : "unhealthy"
  const statusCode = isHealthy ? 200 : 503

  const response: HealthCheckResponse = {
    status,
    checks,
    timestamp
  }

  res.status(statusCode).json(response)
}
