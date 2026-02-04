import { Migration } from "@mikro-orm/migrations"

/**
 * Data hardening:
 * - Add soft-delete support to legacy tables missing `deleted_at`
 * - Add missing performance indexes listed in PLAN.txt
 * - Add `deleted_at` indexes to speed default filtering
 */
export class Migration20260204000009 extends Migration {
  async up(): Promise<void> {
    // Ensure soft-delete support for legacy order_status_event table
    this.addSql(
      `ALTER TABLE "order_status_event" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ NULL`
    )

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_order_status_event_deleted_at" ON "order_status_event" ("deleted_at")`
    )

    // Add deleted_at indexes for business module tables (fast default filtering)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_business_deleted_at" ON "business" ("deleted_at")`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_location_deleted_at" ON "location" ("deleted_at")`)
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_business_product_category_deleted_at" ON "business_product_category" ("deleted_at")`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_consult_submission_deleted_at" ON "consult_submission" ("deleted_at")`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_consult_approval_deleted_at" ON "consult_approval" ("deleted_at")`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_business_domain_deleted_at" ON "business_domain" ("deleted_at")`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_business_user_deleted_at" ON "business_user" ("deleted_at")`
    )

    // PLAN performance indexes on core Medusa tables (only if columns exist)
    this.addSql(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'order' AND column_name = 'business_id'
        ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_order_business_id" ON "order" ("business_id")';
        END IF;

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'order' AND column_name = 'status'
        ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_order_status" ON "order" ("status")';
        END IF;

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'order' AND column_name = 'created_at'
        ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_order_created_at" ON "order" ("created_at")';
        END IF;
      END $$;
    `)

    this.addSql(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'product' AND column_name = 'business_id'
        ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_product_business_id" ON "product" ("business_id")';
        END IF;

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'product' AND column_name = 'status'
        ) THEN
          EXECUTE 'CREATE INDEX IF NOT EXISTS "IDX_product_status" ON "product" ("status")';
        END IF;
      END $$;
    `)
  }

  async down(): Promise<void> {
    // Drop core indexes (safe even if column didn't exist)
    this.addSql(`DROP INDEX IF EXISTS "IDX_order_business_id"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_order_status"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_order_created_at"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_product_business_id"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_product_status"`)

    // Drop deleted_at indexes
    this.addSql(`DROP INDEX IF EXISTS "IDX_business_deleted_at"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_location_deleted_at"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_business_product_category_deleted_at"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_consult_submission_deleted_at"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_consult_approval_deleted_at"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_business_domain_deleted_at"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_business_user_deleted_at"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_order_status_event_deleted_at"`)

    // Remove deleted_at column from legacy table (others already had it)
    this.addSql(`ALTER TABLE "order_status_event" DROP COLUMN IF EXISTS "deleted_at"`)
  }
}

