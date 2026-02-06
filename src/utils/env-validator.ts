import { getEncryptionKeychainFromEnv } from "./encryption"

export type AppEnvConfig = {
  nodeEnv: string
  jwtSecret: string
  cookieSecret: string
  databaseUrl: string
  redisUrl: string
  storeCors: string
  adminCors: string
  authCors: string
  backendUrl: string
  encryption?: {
    currentKey: Buffer
    oldKeys: Buffer[]
  }
  phiEncryptionEnabled: boolean
}

const MIN_SECRET_LENGTH = 64

let cachedConfig: AppEnvConfig | null = null

function requireString(
  env: NodeJS.ProcessEnv,
  key: string,
  opts: { minLength?: number } = {}
): string {
  const value = env[key]
  if (!value) {
    throw new Error(`FATAL: ${key} environment variable is not set.`)
  }
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`FATAL: ${key} environment variable is empty.`)
  }
  if (opts.minLength && trimmed.length < opts.minLength) {
    throw new Error(
      `FATAL: ${key} must be at least ${opts.minLength} characters long. Current length: ${trimmed.length}.`
    )
  }
  return trimmed
}

function optionalString(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key]
  if (value === undefined) return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

export function validateEnv(env: NodeJS.ProcessEnv = process.env): AppEnvConfig {
  const nodeEnv = env.NODE_ENV || "development"
  const phiEncryptionEnabled = (env.PHI_ENCRYPTION_ENABLED || "").toLowerCase() === "true"

  const jwtSecret = requireString(env, "JWT_SECRET", { minLength: MIN_SECRET_LENGTH })
  const cookieSecret = requireString(env, "COOKIE_SECRET", { minLength: MIN_SECRET_LENGTH })

  const databaseUrl = requireString(env, "DATABASE_URL")
  const redisUrl = requireString(env, "REDIS_URL")

  const storeCors = requireString(env, "STORE_CORS")
  const adminCors = requireString(env, "ADMIN_CORS")
  const authCors = requireString(env, "AUTH_CORS")

  const backendUrl = optionalString(env, "MEDUSA_BACKEND_URL") || "http://localhost:9001"

  const encryption =
    phiEncryptionEnabled || nodeEnv === "production"
      ? getEncryptionKeychainFromEnv(env)
      : undefined

  return {
    nodeEnv,
    jwtSecret,
    cookieSecret,
    databaseUrl,
    redisUrl,
    storeCors,
    adminCors,
    authCors,
    backendUrl,
    encryption,
    phiEncryptionEnabled,
  }
}

export function getEnvConfig(env: NodeJS.ProcessEnv = process.env): AppEnvConfig {
  if (!cachedConfig) {
    cachedConfig = validateEnv(env)
  }
  return cachedConfig
}

export function resetEnvConfigCache(): void {
  cachedConfig = null
}
