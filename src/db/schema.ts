import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/**
 * Tenant/estimate schema per ARCHITECTURE.md §4 (M1-02 scope: users, firms,
 * memberships, invitations, projects, estimates/revisions, section
 * snapshots, cost items, line items). Catalog/import tables (price_catalogs,
 * price_entries, imports, import_rows, import_mappings) and firm section
 * *templates* (defaults an estimate's sections are copied from) land with
 * M2-01 / M1-08 respectively.
 */

export const firmRoleEnum = pgEnum("firm_role", ["owner", "member"]);
export const estimateMilestoneEnum = pgEnum("estimate_milestone", [
  "30",
  "60",
  "90",
  "100",
  "custom",
]);
export const estimateStatusEnum = pgEnum("estimate_status", [
  "draft",
  "final",
]);
export const priceSourceEnum = pgEnum("price_source", [
  "seed",
  "firm",
  "manual",
]);
export const matchStatusEnum = pgEnum("match_status", [
  "unpriced",
  "suggested",
  "accepted",
  "manual",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Auth.js email-provider adapter table. Not in the §4 shorthand; required
// for magic-link verification tokens (schema contract agreed with Codex/#6
// in the Jerry Project channel, 2026-08-30).
export const authVerificationTokens = pgTable(
  "auth_verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
);

export const firms = pgTable("firms", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  disclaimerText: text("disclaimer_text"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const firmMembers = pgTable(
  "firm_members",
  {
    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: firmRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.firmId, table.userId] })],
);

// Expiring (7 day), single-use, email-bound invitations (§2 S1).
export const firmInvitations = pgTable("firm_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  location: text("location"),
  district: text("district"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Stable identity across an estimate's revisions (§4, §7 AC7 delta view).
export const costItems = pgTable("cost_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const estimates = pgTable(
  "estimates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    milestone: estimateMilestoneEnum("milestone").notNull(),
    revision: integer("revision").notNull(),
    label: text("label"),
    contingencyPct: numeric("contingency_pct", {
      precision: 5,
      scale: 2,
    }).notNull(),
    status: estimateStatusEnum("status").notNull().default("draft"),
    clonedFromId: uuid("cloned_from_id").references(
      (): AnyPgColumn => estimates.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("estimates_project_milestone_revision_unique").on(
      table.projectId,
      table.milestone,
      table.revision,
    ),
  ],
);

// Snapshot of the firm's section template names at estimate-creation time
// (§7 AC12: editing firm defaults later must not mutate existing estimates).
export const estimateSections = pgTable("estimate_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  estimateId: uuid("estimate_id")
    .notNull()
    .references(() => estimates.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sort: integer("sort").notNull(),
});

export const lineItems = pgTable(
  "line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    estimateId: uuid("estimate_id")
      .notNull()
      .references(() => estimates.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id").references(() => estimateSections.id, {
      onDelete: "set null",
    }),
    costItemId: uuid("cost_item_id")
      .notNull()
      .references(() => costItems.id),
    sort: integer("sort").notNull(),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unit: text("unit").notNull(),
    // Null until a price is suggested/accepted/entered manually.
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }),
    priceSource: priceSourceEnum("price_source"),
    // References price_entries(id), added with that table in M2-01.
    priceEntryId: uuid("price_entry_id"),
    priceProvenance: jsonb("price_provenance"),
    matchConfidence: numeric("match_confidence", { precision: 4, scale: 3 }),
    matchStatus: matchStatusEnum("match_status").notNull().default("unpriced"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Defense in depth alongside the lib/estimate/math.ts application check
    // (ARCHITECTURE.md §4: "Negative quantities are rejected in v1").
    check("line_items_quantity_non_negative", sql`${table.quantity} >= 0`),
  ],
);
