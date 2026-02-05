import { Migration } from "@mikro-orm/migrations"

/**
 * Reliability hardening for consult intake:
 * - Add non-PHI linkage + idempotency fields to consult_submission.
 * - Persist enough intake data for safe reconciliation if the API crashes mid-request.
 * - Add uniqueness guards to prevent duplicate pending submissions/approvals under concurrency.
 */
export class Migration20260205073000 extends Migration {
  async up(): Promise<void> {
    // consult_submission: add linkage/idempotency + persisted intake fields
    this.addSql(`
      ALTER TABLE "consult_submission"
      ADD COLUMN IF NOT EXISTS "customer_id" TEXT NULL,
      ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT NULL,
      ADD COLUMN IF NOT EXISTS "chief_complaint" TEXT NULL,
      ADD COLUMN IF NOT EXISTS "medical_history" JSONB NULL
    `)

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_consult_submission_customer_id" ON "consult_submission" ("customer_id")`
    )

    // If a caller supplies an explicit idempotency key, dedupe consult submissions.
    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_consult_submission_idempotency_unique"
      ON "consult_submission" ("business_id", "customer_id", "idempotency_key")
      WHERE "idempotency_key" IS NOT NULL AND "customer_id" IS NOT NULL AND "deleted_at" IS NULL
    `)

    // Prevent duplicate pending submissions for the same business/customer/product.
    // This is the primary concurrency guard for double-clicks / retries.
    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_consult_submission_pending_unique"
      ON "consult_submission" ("business_id", "customer_id", "product_id")
      WHERE "status" = 'pending' AND "customer_id" IS NOT NULL AND "deleted_at" IS NULL
    `)

    // consult_approval: enforce "one pending approval per business/customer/product"
    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_consult_approval_pending_unique"
      ON "consult_approval" ("business_id", "customer_id", "product_id")
      WHERE "status" = 'pending' AND "deleted_at" IS NULL
    `)

    // consult_approval: enforce "one approval per consultation"
    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_consult_approval_consultation_unique"
      ON "consult_approval" ("consultation_id")
      WHERE "consultation_id" IS NOT NULL AND "deleted_at" IS NULL
    `)
  }

  async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_consult_approval_consultation_unique"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_consult_approval_pending_unique"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_consult_submission_pending_unique"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_consult_submission_idempotency_unique"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_consult_submission_customer_id"`)

    this.addSql(`
      ALTER TABLE "consult_submission"
      DROP COLUMN IF EXISTS "medical_history",
      DROP COLUMN IF EXISTS "chief_complaint",
      DROP COLUMN IF EXISTS "idempotency_key",
      DROP COLUMN IF EXISTS "customer_id"
    `)
  }
}

