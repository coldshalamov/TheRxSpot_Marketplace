import { Migration } from "@mikro-orm/migrations"

/**
 * Adds hierarchy support to product categories and creates location_product table.
 *
 * Changes:
 * - Add business_id, parent_id, rank columns to business_product_category
 * - Rename sort_order to rank for consistency
 * - Create location_product table for assigning products to locations
 */
export class Migration20260205060000 extends Migration {
  async up(): Promise<void> {
    // Add columns to business_product_category for hierarchy support
    this.addSql(`
      ALTER TABLE "business_product_category"
      ADD COLUMN IF NOT EXISTS "business_id" TEXT,
      ADD COLUMN IF NOT EXISTS "parent_id" TEXT,
      ADD COLUMN IF NOT EXISTS "rank" INTEGER NOT NULL DEFAULT 0
    `)

    // Copy sort_order values to rank if sort_order exists
    this.addSql(`
      UPDATE "business_product_category"
      SET "rank" = COALESCE("sort_order", 0)
      WHERE "rank" = 0 OR "rank" IS NULL
    `)

    // Create indexes for the new columns
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "idx_product_category_business" ON "business_product_category" ("business_id")`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "idx_product_category_parent" ON "business_product_category" ("parent_id")`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "idx_product_category_rank" ON "business_product_category" ("business_id", "rank")`
    )

    // Create location_product table
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "location_product" (
        "id" TEXT PRIMARY KEY,
        "location_id" TEXT NOT NULL,
        "product_id" TEXT NOT NULL,
        "category_id" TEXT NULL,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "custom_price" INTEGER NULL,
        "rank" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMPTZ NULL
      )
    `)

    // Create indexes for location_product
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "idx_location_product_location" ON "location_product" ("location_id")`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "idx_location_product_product" ON "location_product" ("product_id")`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_location_product_unique" ON "location_product" ("location_id", "product_id")`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "idx_location_product_rank" ON "location_product" ("location_id", "category_id", "rank")`
    )
  }

  async down(): Promise<void> {
    // Drop location_product table
    this.addSql(`DROP TABLE IF EXISTS "location_product" CASCADE`)

    // Remove indexes from business_product_category
    this.addSql(`DROP INDEX IF EXISTS "idx_product_category_rank"`)
    this.addSql(`DROP INDEX IF EXISTS "idx_product_category_parent"`)
    this.addSql(`DROP INDEX IF EXISTS "idx_product_category_business"`)

    // Remove columns from business_product_category
    this.addSql(`
      ALTER TABLE "business_product_category"
      DROP COLUMN IF EXISTS "rank",
      DROP COLUMN IF EXISTS "parent_id",
      DROP COLUMN IF EXISTS "business_id"
    `)
  }
}
