import { loadEnv, defineConfig } from "@medusajs/framework/utils"
import { getEnvConfig } from "./src/utils/env-validator"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

// Validate all required env vars as early as possible (startup + build).
const env = getEnvConfig(process.env)

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: env.databaseUrl,
    redisUrl: env.redisUrl,
    http: {
      storeCors: env.storeCors,
      adminCors: env.adminCors,
      authCors: env.authCors,
      jwtSecret: env.jwtSecret,
      cookieSecret: env.cookieSecret,
      compression: { enabled: true },
    },
    cookieOptions: {
      sameSite: "strict",
      // In local "start" mode we still run plain HTTP; forcing secure cookies
      // prevents session issuance and breaks admin login bootstrap.
      secure: env.nodeEnv === "production" && env.backendUrl.startsWith("https://"),
      httpOnly: true,
    },
  },
  admin: {
    backendUrl: env.backendUrl,
    path: "/app",
  },
  modules: {
    businessModuleService: {
      resolve: "./src/modules/business",
      definition: {
        isQueryable: true
      }
    },
    consultationModuleService: {
      resolve: "./src/modules/consultation",
      definition: {
        isQueryable: true
      }
    },
    financialsModuleService: {
      resolve: "./src/modules/financials",
      definition: {
        isQueryable: true
      }
    },
    complianceModuleService: {
      resolve: "./src/modules/compliance",
      definition: {
        isQueryable: true
      }
    },
  },
})
