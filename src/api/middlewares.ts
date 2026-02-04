import { MiddlewaresConfig } from "@medusajs/framework/http"
import { tenantResolutionMiddleware } from "./middlewares/tenant-resolution"
import { tenantAdminAuthMiddleware } from "./middlewares/tenant-admin-auth"
import { consultGatingMiddleware } from "./middlewares/consult-gating"
import { autoLogoffMiddleware } from "./middlewares/auto-logoff"
import {
  authRateLimiter,
  consultSubmissionRateLimiter,
  registrationRateLimiter,
  passwordResetRateLimiter,
} from "./middlewares/rate-limiter"
import { auditLoggingMiddleware, documentAuditMiddleware } from "./middlewares/audit-logging"

/**
 * Middleware Configuration
 * 
 * SECURITY & HIPAA COMPLIANCE:
 * - Auto-logoff: 15-minute session timeout (HIPAA-001)
 * - Consult gating: Prevents bypass attacks on cart endpoints (SEC-003, HIPAA-008)
 * - Rate limiting: Prevents abuse on sensitive endpoints
 * - Audit logging: Tracks PHI access for HIPAA compliance
 */
export const config: MiddlewaresConfig = {
  routes: [
    // Tenant resolution for multi-tenant support
    {
      matcher: "/store/*",
      middlewares: [tenantResolutionMiddleware],
    },
    
    // CRITICAL FIX: Auto-logoff middleware for HIPAA-001 compliance
    // Applies 15-minute inactivity timeout to all authenticated routes
    {
      matcher: "/store/*",
      middlewares: [autoLogoffMiddleware],
    },
    {
      matcher: "/admin/*",
      middlewares: [autoLogoffMiddleware],
    },
    
    // CRITICAL FIX: Consult gating covers ALL cart modification endpoints
    // Prevents bypass attacks via cart creation, batch operations, etc.
    // 
    // Covered endpoints:
    // - POST /store/carts (creation with pre-populated items)
    // - POST /store/carts/:id/line-items
    // - POST /store/carts/:id/line-items/batch
    // - POST /store/carts/:id/items
    // - POST /store/carts/:id/items/batch
    // - POST/PUT /store/carts/:id (updates)
    {
      matcher: "/store/carts",
      middlewares: [consultGatingMiddleware],
    },
    {
      matcher: "/store/carts/*",
      middlewares: [consultGatingMiddleware],
    },
    {
      matcher: "/store/carts/*/line-items",
      middlewares: [consultGatingMiddleware],
    },
    {
      matcher: "/store/carts/*/line-items/*",
      middlewares: [consultGatingMiddleware],
    },
    {
      matcher: "/store/carts/*/items",
      middlewares: [consultGatingMiddleware],
    },
    {
      matcher: "/store/carts/*/items/*",
      middlewares: [consultGatingMiddleware],
    },
    
    // Rate limiting for authentication endpoints
    {
      matcher: "/auth/*",
      middlewares: [authRateLimiter],
    },
    {
      matcher: "/store/customers",
      method: "POST",
      middlewares: [registrationRateLimiter],
    },
    {
      matcher: "/auth/customer/*/reset-password",
      middlewares: [passwordResetRateLimiter],
    },
    {
      matcher: "/store/businesses/*/consult",
      method: "POST",
      middlewares: [consultSubmissionRateLimiter],
    },
    
    // Tenant admin authentication
    {
      matcher: "/admin/tenant/*",
      middlewares: [tenantAdminAuthMiddleware],
    },
    
    // Audit logging middleware for PHI access (HIPAA compliance)
    {
      matcher: "/admin/consultations*",
      middlewares: [auditLoggingMiddleware],
    },
    {
      matcher: "/admin/patients*",
      middlewares: [auditLoggingMiddleware],
    },
    {
      matcher: "/admin/documents*",
      middlewares: [documentAuditMiddleware],
    },
    {
      matcher: "/admin/orders*",
      middlewares: [auditLoggingMiddleware],
    },
    {
      matcher: "/admin/earnings*",
      middlewares: [auditLoggingMiddleware],
    },
    {
      matcher: "/admin/payouts*",
      middlewares: [auditLoggingMiddleware],
    },
    {
      matcher: "/store/documents*",
      middlewares: [documentAuditMiddleware],
    },
    {
      matcher: "/store/consultations*",
      middlewares: [auditLoggingMiddleware],
    },
    // CRITICAL FIX: Audit logging for cart/checkout with PHI (HIPAA-008)
    {
      matcher: "/store/carts*",
      middlewares: [auditLoggingMiddleware],
    },
  ],
}
