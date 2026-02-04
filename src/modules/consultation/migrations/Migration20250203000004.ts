import { Migration } from '@mikro-orm/migrations';

export class Migration20250203000004 extends Migration {

  async up(): Promise<void> {
    // Create clinician_schedule table
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "clinician_schedule" (
        "id" TEXT PRIMARY KEY,
        "clinician_id" TEXT NOT NULL,
        "day_of_week" INTEGER NOT NULL CHECK ("day_of_week" >= 0 AND "day_of_week" <= 6),
        "start_time" TEXT NOT NULL,
        "end_time" TEXT NOT NULL,
        "is_available" BOOLEAN NOT NULL DEFAULT TRUE,
        "effective_from" TIMESTAMPTZ NOT NULL,
        "effective_to" TIMESTAMPTZ NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_clinician_schedule_clinician_id" ON "clinician_schedule" ("clinician_id")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_clinician_schedule_day_of_week" ON "clinician_schedule" ("day_of_week")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_clinician_schedule_effective" ON "clinician_schedule" ("effective_from", "effective_to")`);

    // Create clinician_availability_exception table
    this.addSql(`
      CREATE TABLE IF NOT EXISTS "clinician_availability_exception" (
        "id" TEXT PRIMARY KEY,
        "clinician_id" TEXT NOT NULL,
        "date" TIMESTAMPTZ NOT NULL,
        "is_available" BOOLEAN NOT NULL DEFAULT FALSE,
        "reason" TEXT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_clinician_availability_exception_clinician_id" ON "clinician_availability_exception" ("clinician_id")`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_clinician_availability_exception_date" ON "clinician_availability_exception" ("date")`);
  }

  async down(): Promise<void> {
    this.addSql(`DROP TABLE IF EXISTS "clinician_schedule"`);
    this.addSql(`DROP TABLE IF EXISTS "clinician_availability_exception"`);
  }

}
