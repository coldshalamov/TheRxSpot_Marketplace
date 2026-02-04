import { model } from "@medusajs/framework/utils"

export const AuditLog = model.define("audit_log", {
  id: model.id().primaryKey(),
  actor_type: model.enum(["customer", "business_user", "clinician", "system", "api_key"]),
  actor_id: model.text(),
  actor_email: model.text().nullable(),
  ip_address: model.text().nullable(),
  user_agent: model.text().nullable(),
  action: model.enum(["create", "read", "update", "delete", "download", "login", "logout", "export"]),
  entity_type: model.enum(["consultation", "order", "document", "patient", "business", "earning", "payout"]),
  entity_id: model.text(),
  business_id: model.text().nullable(),
  consultation_id: model.text().nullable(),
  order_id: model.text().nullable(),
  changes: model.json().nullable(),
  metadata: model.json().nullable(),
  risk_level: model.enum(["low", "medium", "high", "critical"]).default("low"),
  flagged: model.boolean().default(false),
})
