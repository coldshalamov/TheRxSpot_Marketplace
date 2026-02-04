import { Migration } from "@mikro-orm/migrations"

/**
 * BigNumber column compatibility for Medusa v2.
 *
 * Medusa's `model.bigNumber()` maps to `raw_<field>` JSONB columns.
 * The baseline Business migration created `consult_fee` as a numeric column,
 * but the module runtime expects `raw_consult_fee`, leading to runtime errors:
 *   column "raw_consult_fee" of relation "consult_submission" does not exist
 */
export class Migration20260204000015 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      `ALTER TABLE "consult_submission" ADD COLUMN IF NOT EXISTS "raw_consult_fee" JSONB NULL`
    )

    // Backfill raw column from legacy numeric column when possible.
    this.addSql(`
      UPDATE "consult_submission"
      SET
        "raw_consult_fee" = COALESCE("raw_consult_fee", jsonb_build_object('value', "consult_fee"::text, 'precision', 20))
      WHERE "consult_fee" IS NOT NULL
    `)
  }

  async down(): Promise<void> {
    // Keep column for safety; no-op rollback.
  }
}

