import { Migration } from "@mikro-orm/migrations"

/**
 * BigNumber column compatibility for Medusa v2.
 *
 * Medusa's `model.bigNumber()` maps to `raw_<field>` JSONB columns
 * (e.g. `raw_net_amount`), not plain numeric columns.
 *
 * The initial financials migration created numeric columns (`net_amount`, etc.)
 * which causes runtime errors like:
 *   column "raw_net_amount" does not exist
 *
 * This migration:
 * - Adds `raw_*` JSONB columns for all bigNumber fields.
 * - Drops NOT NULL constraints on the legacy numeric columns so inserts won't fail.
 */
export class Migration20260204000004 extends Migration {
  async up(): Promise<void> {
    // earning_entry: raw_* columns
    this.addSql(`ALTER TABLE "earning_entry" ADD COLUMN IF NOT EXISTS "raw_gross_amount" JSONB NULL`)
    this.addSql(`ALTER TABLE "earning_entry" ADD COLUMN IF NOT EXISTS "raw_platform_fee" JSONB NULL`)
    this.addSql(
      `ALTER TABLE "earning_entry" ADD COLUMN IF NOT EXISTS "raw_payment_processing_fee" JSONB NULL`
    )
    this.addSql(`ALTER TABLE "earning_entry" ADD COLUMN IF NOT EXISTS "raw_net_amount" JSONB NULL`)
    this.addSql(`ALTER TABLE "earning_entry" ADD COLUMN IF NOT EXISTS "raw_clinician_fee" JSONB NULL`)

    // Backfill raw columns from legacy numeric columns when possible
    this.addSql(`
      UPDATE "earning_entry"
      SET
        "raw_gross_amount" = COALESCE("raw_gross_amount", jsonb_build_object('value', "gross_amount"::text, 'precision', 20)),
        "raw_platform_fee" = COALESCE("raw_platform_fee", jsonb_build_object('value', "platform_fee"::text, 'precision', 20)),
        "raw_payment_processing_fee" = COALESCE("raw_payment_processing_fee", jsonb_build_object('value', "payment_processing_fee"::text, 'precision', 20)),
        "raw_net_amount" = COALESCE("raw_net_amount", jsonb_build_object('value', "net_amount"::text, 'precision', 20)),
        "raw_clinician_fee" = CASE
          WHEN "clinician_fee" IS NULL THEN "raw_clinician_fee"
          ELSE COALESCE("raw_clinician_fee", jsonb_build_object('value', "clinician_fee"::text, 'precision', 20))
        END
    `)

    // Allow legacy numeric columns to be null (Medusa writes raw_* columns)
    this.addSql(`ALTER TABLE "earning_entry" ALTER COLUMN "gross_amount" DROP NOT NULL`)
    this.addSql(`ALTER TABLE "earning_entry" ALTER COLUMN "platform_fee" DROP NOT NULL`)
    this.addSql(`ALTER TABLE "earning_entry" ALTER COLUMN "payment_processing_fee" DROP NOT NULL`)
    this.addSql(`ALTER TABLE "earning_entry" ALTER COLUMN "net_amount" DROP NOT NULL`)

    // payout: raw_* columns + legacy numeric columns nullable
    this.addSql(`ALTER TABLE "payout" ADD COLUMN IF NOT EXISTS "raw_total_amount" JSONB NULL`)
    this.addSql(`ALTER TABLE "payout" ADD COLUMN IF NOT EXISTS "raw_fee_amount" JSONB NULL`)
    this.addSql(`ALTER TABLE "payout" ADD COLUMN IF NOT EXISTS "raw_net_amount" JSONB NULL`)

    this.addSql(`
      UPDATE "payout"
      SET
        "raw_total_amount" = COALESCE("raw_total_amount", jsonb_build_object('value', "total_amount"::text, 'precision', 20)),
        "raw_fee_amount" = COALESCE("raw_fee_amount", jsonb_build_object('value', "fee_amount"::text, 'precision', 20)),
        "raw_net_amount" = COALESCE("raw_net_amount", jsonb_build_object('value', "net_amount"::text, 'precision', 20))
    `)

    this.addSql(`ALTER TABLE "payout" ALTER COLUMN "total_amount" DROP NOT NULL`)
    this.addSql(`ALTER TABLE "payout" ALTER COLUMN "fee_amount" DROP NOT NULL`)
    this.addSql(`ALTER TABLE "payout" ALTER COLUMN "net_amount" DROP NOT NULL`)
  }

  async down(): Promise<void> {
    // Keep columns for safety; no-op rollback.
  }
}

