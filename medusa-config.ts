import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// Validate JWT and Cookie secrets at startup
const jwtSecret = process.env.JWT_SECRET
const cookieSecret = process.env.COOKIE_SECRET

if (!jwtSecret) {
  throw new Error(
    'FATAL: JWT_SECRET environment variable is not set. ' +
    'Please generate a secure secret (at least 64 characters) and set it in your .env file. ' +
    'Example: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
  )
}

if (!cookieSecret) {
  throw new Error(
    'FATAL: COOKIE_SECRET environment variable is not set. ' +
    'Please generate a secure secret (at least 64 characters) and set it in your .env file. ' +
    'Example: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
  )
}

const MIN_SECRET_LENGTH = 64

if (jwtSecret.length < MIN_SECRET_LENGTH) {
  throw new Error(
    `FATAL: JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters long. ` +
    `Current length: ${jwtSecret.length} characters. ` +
    'Please generate a stronger secret.'
  )
}

if (cookieSecret.length < MIN_SECRET_LENGTH) {
  throw new Error(
    `FATAL: COOKIE_SECRET must be at least ${MIN_SECRET_LENGTH} characters long. ` +
    `Current length: ${cookieSecret.length} characters. ` +
    'Please generate a stronger secret.'
  )
}

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: jwtSecret,
      cookieSecret: cookieSecret,
      compression: { enabled: true },
      cookieOptions: {
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        httpOnly: true
      }
    }
  },
  modules: [
    {
      resolve: "./modules/business",
    },
    {
      resolve: "./modules/consultation",
    },
    {
      resolve: "./modules/financials",
    },
    {
      resolve: "./modules/compliance",
    },
  ],
})
