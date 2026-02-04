import { Migration } from "@mikro-orm/migrations"

/**
 * Add "paid_out" status for earning_entry.
 *
 * PLAN uses "paid_out" to represent earnings locked to a payout request.
 */
export class Migration20260204000006 extends Migration {
  async up(): Promise<void> {
    // Drop any existing status CHECK constraint (name may vary by environment)
    this.addSql(`
      DO $$
      DECLARE c_name text;
      BEGIN
        FOR c_name IN
          SELECT c.conname
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          WHERE t.relname = 'earning_entry'
            AND c.contype = 'c'
            AND pg_get_constraintdef(c.oid) ILIKE '%status%'
        LOOP
          EXECUTE format('ALTER TABLE "earning_entry" DROP CONSTRAINT %I', c_name);
        END LOOP;
      END $$;
    `)

    this.addSql(`
      ALTER TABLE "earning_entry"
      ADD CONSTRAINT "CHK_earning_entry_status"
      CHECK ("status" IN ('pending', 'available', 'paid_out', 'paid', 'reversed'))
    `)
  }

  async down(): Promise<void> {
    // Keep expanded constraint (no-op rollback)
  }
}
