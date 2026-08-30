import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { db } from "./client";
import { firmMembers, firms, users } from "./schema";

/**
 * Exercises the migrated schema against a real Postgres. Requires
 * DATABASE_URL to point at an already-migrated database (`npm run
 * db:migrate`); skipped otherwise so `npm test` stays hermetic without a
 * running Postgres. CI provides both via the `postgres` service and a
 * migrate step before `npm run check`.
 */
describe.skipIf(!process.env.DATABASE_URL)("schema (integration)", () => {
  afterAll(async () => {
    await db.$client.end();
  });

  it("round-trips a firm, a user, and a membership", async () => {
    const [firm] = await db
      .insert(firms)
      .values({ name: "Test Firm" })
      .returning();
    const [user] = await db
      .insert(users)
      .values({ email: `owner-${Date.now()}@example.com` })
      .returning();

    if (!firm || !user) throw new Error("insert did not return a row");

    await db
      .insert(firmMembers)
      .values({ firmId: firm.id, userId: user.id, role: "owner" });

    const result = await db.execute(
      sql`select role from firm_members where firm_id = ${firm.id} and user_id = ${user.id}`,
    );

    expect(result.rows[0]?.role).toBe("owner");
  });

  it("rejects a negative line-item quantity at the database level", async () => {
    // No firm/estimate scaffolding needed: the CHECK constraint fires
    // before any foreign-key lookup, so a bare insert is enough to prove
    // ARCHITECTURE.md §4's "negative quantities rejected" is enforced
    // even if application-level validation is bypassed.
    const insert = db.execute(
      sql`insert into line_items (estimate_id, cost_item_id, sort, description, quantity, unit)
          values (gen_random_uuid(), gen_random_uuid(), 0, 'bad row', -1, 'LF')`,
    );

    await expect(insert).rejects.toMatchObject({
      cause: {
        message: expect.stringContaining(
          'violates check constraint "line_items_quantity_non_negative"',
        ),
      },
    });
  });
});
