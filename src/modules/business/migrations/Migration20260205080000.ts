import { Migration } from "@mikro-orm/migrations"

/**
 * Phase 1 - Template Foundation:
 * Create template_config table for the section/block template engine.
 * Each business gets a template_config row controlling storefront layout.
 */
export class Migration20260205080000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "template_config" (
        "id" TEXT NOT NULL,
        "business_id" TEXT NOT NULL,
        "template_id" TEXT NOT NULL DEFAULT 'default',
        "version" INTEGER NOT NULL DEFAULT 1,
        "is_published" BOOLEAN NOT NULL DEFAULT FALSE,
        "sections" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "global_styles" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "published_at" TIMESTAMPTZ NULL,
        "published_by" TEXT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ NULL,
        CONSTRAINT "template_config_pkey" PRIMARY KEY ("id")
      )
    `)

    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_template_config_business_id" ON "template_config" ("business_id")`
    )

    this.addSql(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_template_config_business_published"
      ON "template_config" ("business_id")
      WHERE "is_published" = TRUE AND "deleted_at" IS NULL
    `)
  }

  async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_template_config_business_published"`)
    this.addSql(`DROP INDEX IF EXISTS "IDX_template_config_business_id"`)
    this.addSql(`DROP TABLE IF EXISTS "template_config"`)
  }
}
