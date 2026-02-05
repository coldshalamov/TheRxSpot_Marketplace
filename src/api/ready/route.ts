import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { randomUUID } from "crypto"
import { getLogger } from "../../utils/logger"

interface ReadinessResponse {
  status: "ready" | "not_ready"
  checks: {
    database: "ok" | "error"
    redis: "ok" | "error"
  }
  timestamp: string
}

/**
 * Readiness probe for orchestration platforms.
 * This must fail if Redis or Postgres are degraded.
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse<ReadinessResponse>
): Promise<void> {
  const logger = getLogger()
  const container = req.scope as any
  const timestamp = new Date().toISOString()

  const checks: ReadinessResponse["checks"] = {
    database: "error",
    redis: "error",
  }

  try {
    const query = container.resolve("query")
    await query.graph({
      entity: "region",
      fields: ["id"],
      take: 1,
    })
    checks.database = "ok"
  } catch (error) {
    logger.error({ error }, "Readiness check: database read failed")
    checks.database = "error"
  }

  try {
    const redisClient = container.resolve("redis")
    if (!redisClient || typeof redisClient.set !== "function") {
      throw new Error("Redis client not available")
    }
    const key = `ready:ping:${randomUUID()}`
    await redisClient.set(key, "1", "EX", 15)
    checks.redis = "ok"
  } catch (error) {
    logger.error({ error }, "Readiness check: redis write failed")
    checks.redis = "error"
  }

  const isReady = checks.database === "ok" && checks.redis === "ok"
  const statusCode = isReady ? 200 : 503

  res.status(statusCode).json({
    status: isReady ? "ready" : "not_ready",
    checks,
    timestamp,
  })
}

