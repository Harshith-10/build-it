import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

// ─── Tickets ──────────────────────────────────────────────────────────────────

export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  // "open" | "resolved" | "rejected"
  status: text("status").notNull().default("open"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  resolvedBy: text("resolved_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const ticketsRelations = relations(tickets, ({ one }) => ({
  creator: one(user, {
    fields: [tickets.createdBy],
    references: [user.id],
    relationName: "ticketCreator",
  }),
  resolver: one(user, {
    fields: [tickets.resolvedBy],
    references: [user.id],
    relationName: "ticketResolver",
  }),
}));
