import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

// Unlike service.integration.test.ts, this suite deliberately does NOT mock
// ../auth/authorization: it exercises the real requireAuthenticatedUser ->
// requireFirmMember chain against a real Postgres, only faking the
// next-auth session getter (same pattern as
// ../invitations/service.integration.test.ts).
vi.mock("../auth", () => ({ auth: vi.fn() }));

import { auth } from "../auth";
import { UnauthorizedError } from "../auth/authorization-policy";
import { db } from "../db/client";
import { firms, projects, users } from "../db/schema";

import { getEstimate, getProject, ProjectNotFoundError } from "./service";

/**
 * Regression test for #33 item 2: loadProjectForMember / loadEstimateForMember
 * used to check resource existence before authentication, so an
 * unauthenticated caller could tell an existing UUID (redirect to sign-in)
 * from a missing one (404) without ever proving who they are. After the
 * fix both cases must throw the same UnauthorizedError.
 */
describe.skipIf(!process.env.DATABASE_URL)("resource loader auth ordering", () => {
  const suffix = randomUUID();
  let firmId = "";

  afterAll(async () => {
    if (firmId) await db.delete(firms).where(eq(firms.id, firmId));
    await db.$client.end();
  });

  it("returns UnauthorizedError for both an existing and a missing project id when unauthenticated", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth).mockResolvedValue(null as any);

    const [firm] = await db.insert(firms).values({ name: `Oracle Co ${suffix}` }).returning();
    if (!firm) throw new Error("insert did not return a row");
    firmId = firm.id;
    const [project] = await db.insert(projects).values({ firmId, name: "Existing Project" }).returning();
    if (!project) throw new Error("insert did not return a row");

    await expect(getProject(project.id)).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(getProject(randomUUID())).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("returns UnauthorizedError for a missing estimate id when unauthenticated (no existence leak)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth).mockResolvedValue(null as any);

    await expect(getEstimate(randomUUID())).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("still resolves a real session normally once authenticated", async () => {
    const [user] = await db.insert(users).values({ email: `oracle-${suffix}@example.test` }).returning();
    if (!user) throw new Error("insert did not return a row");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth).mockResolvedValue({ user: { email: user.email } } as any);

    await expect(getProject(randomUUID())).rejects.toBeInstanceOf(ProjectNotFoundError);

    await db.delete(users).where(eq(users.id, user.id));
  });
});
