import { Migration } from "@mikro-orm/migrations"

/**
 * Baseline tables for the Business module.
 *
 * NOTE:
 * This repo defines several Business-module models but previously only had
 * a migration for `order_status_event`. Medusa v2's module migrator will not
 * auto-create tables for custom models without migrations, so clean DBs and
 * integration tests would fail with `relation "<table>" does not exist`.
 */
export class Migration20260204000001 extends Migration {
  async up(): Promise<void> {
    // `business`
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "business" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "logo_url" TEXT NULL,
        "primary_color" TEXT NULL,
        "secondary_color" TEXT NULL,
        "custom_html_head" TEXT NULL,
        "custom_html_body" TEXT NULL,
        "domain" TEXT NULL,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "branding_config" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "domain_config" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "catalog_config" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "settings" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "sales_channel_id" TEXT NULL,
        "publishable_api_key_id" TEXT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMPTZ NULL
      )
    `)

    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_business_slug_unique" ON "business" ("slug")`
    )
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_business_domain_unique" ON "business" ("domain") WHERE "domain" IS NOT NULL`
    )

    // `location`
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "location" (
        "id" TEXT PRIMARY KEY,
        "business_id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "phone" TEXT NOT NULL,
        "email" TEXT NULL,
        "address" TEXT NULL,
        "city" TEXT NULL,
        "state" TEXT NULL,
        "zip" TEXT NULL,
        "serviceable_states" TEXT[] NOT NULL DEFAULT '{}'::text[],
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMPTZ NULL
      )
    `)
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_location_business_id" ON "location" ("business_id")`
    )

    // `business_product_category`
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "business_product_category" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "description" TEXT NULL,
        "image_url" TEXT NULL,
        "requires_consult" BOOLEAN NOT NULL DEFAULT FALSE,
        "sort_order" INTEGER NOT NULL DEFAULT 0,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMPTZ NULL
      )
    `)
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_business_product_category_active" ON "business_product_category" ("is_active")`
    )

    // `consult_submission`
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "consult_submission" (
        "id" TEXT PRIMARY KEY,
        "business_id" TEXT NOT NULL,
        "location_id" TEXT NULL,
        "product_id" TEXT NOT NULL,
        "customer_email" TEXT NOT NULL,
        "customer_first_name" TEXT NOT NULL,
        "customer_last_name" TEXT NOT NULL,
        "customer_phone" TEXT NULL,
        "customer_dob" TEXT NULL,
        "eligibility_answers" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "consult_fee" NUMERIC NULL,
        "notes" TEXT NULL,
        "reviewed_by" TEXT NULL,
        "reviewed_at" TIMESTAMPTZ NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMPTZ NULL
      )
    `)
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_consult_submission_business_id" ON "consult_submission" ("business_id")`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_consult_submission_product_id" ON "consult_submission" ("product_id")`
    )

    // `consult_approval`
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "consult_approval" (
        "id" TEXT PRIMARY KEY,
        "customer_id" TEXT NOT NULL,
        "product_id" TEXT NOT NULL,
        "business_id" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "consultation_id" TEXT NULL,
        "approved_by" TEXT NULL,
        "approved_at" TIMESTAMPTZ NULL,
        "expires_at" TIMESTAMPTZ NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMPTZ NULL
      )
    `)
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_consult_approval_customer_product" ON "consult_approval" ("customer_id", "product_id")`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_consult_approval_business_id" ON "consult_approval" ("business_id")`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_consult_approval_status" ON "consult_approval" ("status")`
    )

    // `business_domain`
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "business_domain" (
        "id" TEXT PRIMARY KEY,
        "business_id" TEXT NOT NULL,
        "domain" TEXT NOT NULL,
        "is_primary" BOOLEAN NOT NULL DEFAULT FALSE,
        "is_verified" BOOLEAN NOT NULL DEFAULT FALSE,
        "verified_at" TIMESTAMPTZ NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMPTZ NULL
      )
    `)
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_business_domain_domain_unique" ON "business_domain" ("domain")`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_business_domain_business_id" ON "business_domain" ("business_id")`
    )

    // `business_user`
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "business_user" (
        "id" TEXT PRIMARY KEY,
        "business_id" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'staff',
        "auth_identity_id" TEXT NULL,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMPTZ NULL
      )
    `)
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_business_user_business_id" ON "business_user" ("business_id")`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_business_user_auth_identity_id" ON "business_user" ("auth_identity_id")`
    )
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "business_user" CASCADE`)
    this.addSql(`DROP TABLE IF EXISTS "business_domain" CASCADE`)
    this.addSql(`DROP TABLE IF EXISTS "consult_approval" CASCADE`)
    this.addSql(`DROP TABLE IF EXISTS "consult_submission" CASCADE`)
    this.addSql(`DROP TABLE IF EXISTS "business_product_category" CASCADE`)
    this.addSql(`DROP TABLE IF EXISTS "location" CASCADE`)
    this.addSql(`DROP TABLE IF EXISTS "business" CASCADE`)
  }
}
