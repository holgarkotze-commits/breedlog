import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

// Session storage table for express-session
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// Device-based user storage table
// Each device gets a unique user record based on deviceId.
// sharedUserId: when a second device activates the same invite code, this field
// points to the first device's user.id so both devices share the same data workspace.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").unique(), // Unique device identifier
  deviceName: varchar("device_name"), // Optional device/user name
  sharedUserId: varchar("shared_user_id"), // When set, use this userId for all data queries (shared workspace)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: text("password_hash"),
    authProvider: varchar("auth_provider", { length: 32 }).notNull().default("local"),
    emailVerified: boolean("email_verified").notNull().default(false),
    emailVerifiedAt: timestamp("email_verified_at"),
    recoveryRequired: boolean("recovery_required").notNull().default(false),
    googleSubject: varchar("google_subject", { length: 255 }),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    lastLoginAt: timestamp("last_login_at"),
  },
  (table) => [
    uniqueIndex("accounts_email_unique").on(table.email),
    uniqueIndex("accounts_google_subject_unique").on(table.googleSubject),
  ],
);

export const accountWorkspaces = pgTable(
  "account_workspaces",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    accountId: varchar("account_id")
      .notNull()
      .references(() => accounts.id),
    workspaceUserId: varchar("workspace_user_id")
      .notNull()
      .references(() => users.id),
    legacyDeviceUserId: varchar("legacy_device_user_id").references(() => users.id),
    migrationSource: varchar("migration_source", { length: 32 }).notNull().default("managed_account"),
    migrationState: varchar("migration_state", { length: 32 }).notNull().default("completed"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("account_workspaces_account_id_unique").on(table.accountId),
    uniqueIndex("account_workspaces_workspace_user_id_unique").on(table.workspaceUserId),
  ],
);

export const accountDevices = pgTable(
  "account_devices",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    accountId: varchar("account_id")
      .notNull()
      .references(() => accounts.id),
    workspaceUserId: varchar("workspace_user_id")
      .notNull()
      .references(() => users.id),
    deviceUserId: varchar("device_user_id")
      .notNull()
      .references(() => users.id),
    deviceId: varchar("device_id", { length: 128 }).notNull(),
    deviceName: text("device_name"),
    platform: varchar("platform", { length: 32 }),
    authProvider: varchar("auth_provider", { length: 32 }).notNull().default("local"),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    lastSeenAt: timestamp("last_seen_at").defaultNow(),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("account_devices_device_id_unique").on(table.deviceId),
    index("account_devices_account_id_idx").on(table.accountId),
  ],
);

export const accountTokens = pgTable(
  "account_tokens",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    accountId: varchar("account_id")
      .notNull()
      .references(() => accounts.id),
    tokenType: varchar("token_type", { length: 32 }).notNull(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    consumedAt: timestamp("consumed_at"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("account_tokens_account_id_idx").on(table.accountId),
    uniqueIndex("account_tokens_type_hash_unique").on(table.tokenType, table.tokenHash),
  ],
);

export const accountAuditEvents = pgTable(
  "account_audit_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    accountId: varchar("account_id").references(() => accounts.id),
    workspaceUserId: varchar("workspace_user_id").references(() => users.id),
    deviceId: varchar("device_id", { length: 128 }),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    result: varchar("result", { length: 32 }).notNull().default("success"),
    detail: text("detail"),
    metadata: jsonb("metadata"),
    occurredAt: timestamp("occurred_at").defaultNow(),
  },
  (table) => [index("account_audit_events_account_id_idx").on(table.accountId, table.occurredAt)],
);

export const billingCatalog = pgTable("billing_catalog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: varchar("provider", { length: 40 }).notNull(),
  planId: varchar("plan_id", { length: 32 }).notNull(),
  billingPeriod: varchar("billing_period", { length: 16 }).notNull(),
  currency: varchar("currency", { length: 8 }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  pricingVersion: varchar("pricing_version", { length: 32 }).notNull(),
  active: boolean("active").notNull().default(true),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type UpsertAccount = typeof accounts.$inferInsert;
export type AccountWorkspace = typeof accountWorkspaces.$inferSelect;
export type AccountDevice = typeof accountDevices.$inferSelect;
export type AccountToken = typeof accountTokens.$inferSelect;
export type AccountAuditEvent = typeof accountAuditEvents.$inferSelect;
