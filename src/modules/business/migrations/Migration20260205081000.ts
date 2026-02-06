import { Migration } from "@mikro-orm/migrations"

/**
 * Phase 1 - Admin Parity: Coupon management.
 * Create coupon table for per-business coupon/discount management.
 */
export class Migration20260205081000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "coupon" (
        "id" TEXT NOT NULL,
        "business_id" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "type" TEXT NOT NULL DEFAULT 'percentage',
        "value" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "min_order_amount" NUMERIC(12,2) NULL,
        "max_discount_amount" NUMERIC(12,2) NULL,
        "usage_limit" INTEGER NULL,
        "usage_count" INTEGER NOT NULL DEFAULT 0,
        "per_customer_limit" INTEGER NULL,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "starts_at" TIMESTAMPTZ NULL,
        "ends_at" TIMESTAMPTZ NULL,
        "applies_to" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ NULL,
        CONSTRAINT "coupon_pkey" PRIMARY KEY ("id")
      )
    `)

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_coupon_business_id" ON "coupon" ("business_id")`
    )

    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_coupon_business_code_unique"
      ON "coupon" ("business_id", LOWER("code"))
      WHERE "deleted_at" IS NULL
    `)
  }

  async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_coupon_business_code_unique"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_coupon_business_id"`)
    this.addSql(`DROP TABLE IF EXISTS "coupon"`)
  }
}
