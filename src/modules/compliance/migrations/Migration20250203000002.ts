import { Migration } from '@mikro-orm/migrations';

export class Migration20250203000002 extends Migration {

  async up(): Promise<void> {
    // Create document table
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "document" (
        "id" TEXT PRIMARY KEY,
        "business_id" TEXT NOT NULL,
        "patient_id" TEXT NOT NULL,
        "consultation_id" TEXT NULL,
        "order_id" TEXT NULL,
        "uploaded_by" TEXT NOT NULL,
        "type" TEXT NOT NULL CHECK ("type" IN ('prescription', 'lab_result', 'medical_record', 'consent_form', 'id_verification', 'insurance_card', 'other')),
        "title" TEXT NOT NULL,
        "description" TEXT NULL,
        "storage_provider" TEXT NOT NULL CHECK ("storage_provider" IN ('s3', 'gcs', 'azure', 'local')),
        "storage_bucket" TEXT NOT NULL,
        "storage_key" TEXT NOT NULL,
        "file_name" TEXT NOT NULL,
        "file_size" INTEGER NOT NULL,
        "mime_type" TEXT NOT NULL,
        "checksum" TEXT NOT NULL,
        "encryption_key_id" TEXT NULL,
        "is_encrypted" BOOLEAN NOT NULL DEFAULT FALSE,
        "access_level" TEXT NOT NULL CHECK ("access_level" IN ('patient_only', 'clinician', 'business_staff', 'platform_admin')),
        "expires_at" TIMESTAMPTZ NULL,
        "download_count" INTEGER NOT NULL DEFAULT 0,
        "last_downloaded_at" TIMESTAMPTZ NULL,
        "last_downloaded_by" TEXT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_document_business_id" ON "document" ("business_id")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_document_patient_id" ON "document" ("patient_id")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_document_consultation_id" ON "document" ("consultation_id")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_document_order_id" ON "document" ("order_id")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_document_type" ON "document" ("type")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_document_access_level" ON "document" ("access_level")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_document_created_at" ON "document" ("created_at")`);

    // Create audit_log table
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "audit_log" (
        "id" TEXT PRIMARY KEY,
        "actor_type" TEXT NOT NULL CHECK ("actor_type" IN ('customer', 'business_user', 'clinician', 'system', 'api_key')),
        "actor_id" TEXT NOT NULL,
        "actor_email" TEXT NULL,
        "ip_address" TEXT NULL,
        "user_agent" TEXT NULL,
        "action" TEXT NOT NULL CHECK ("action" IN ('create', 'read', 'update', 'delete', 'download', 'login', 'logout', 'export')),
        "entity_type" TEXT NOT NULL CHECK ("entity_type" IN ('consultation', 'order', 'document', 'patient', 'business', 'earning', 'payout')),
        "entity_id" TEXT NOT NULL,
        "business_id" TEXT NULL,
        "consultation_id" TEXT NULL,
        "order_id" TEXT NULL,
        "changes" JSONB NULL,
        "metadata" JSONB NULL,
        "risk_level" TEXT NOT NULL DEFAULT 'low' CHECK ("risk_level" IN ('low', 'medium', 'high', 'critical')),
        "flagged" BOOLEAN NOT NULL DEFAULT FALSE,
        "created_at" TIMESTAMPTZ NOT NULL
      )
    `);

    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_audit_log_actor" ON "audit_log" ("actor_type", "actor_id")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_audit_log_entity" ON "audit_log" ("entity_type", "entity_id")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_audit_log_business_id" ON "audit_log" ("business_id")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_audit_log_action" ON "audit_log" ("action")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_audit_log_risk_level" ON "audit_log" ("risk_level")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_audit_log_flagged" ON "audit_log" ("flagged")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_audit_log_created_at" ON "audit_log" ("created_at")`);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "document"`);
    this.addSql(`DROP TABLE IF EXISTS "audit_log"`);
  }

}
