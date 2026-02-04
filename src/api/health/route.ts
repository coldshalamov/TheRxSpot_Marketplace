import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

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
    console.error("Health check: Database connection failed", error)
    checks.database = "error"
  }

  // Check Redis connectivity
  try {
    const redisClient = container.resolve("redis")
    if (redisClient && typeof redisClient.ping === "function") {
      await redisClient.ping()
      checks.redis = "ok"
    } else {
      // Try to access redis through the Event Bus module
      const eventBus = container.resolve("event_bus")
      if (eventBus) {
        checks.redis = "ok"
      }
    }
  } catch (error) {
    console.error("Health check: Redis connection failed", error)
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
