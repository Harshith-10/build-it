import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const platformVisits = pgTable(
  "platform_visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("platform_visits_created_at_idx").on(table.createdAt),
    index("platform_visits_user_id_idx").on(table.userId),
    index("platform_visits_user_created_idx").on(table.userId, table.createdAt),
    index("platform_visits_path_idx").on(table.path),
  ],
);

export const platformVisitsRelations = relations(platformVisits, ({ one }) => ({
  user: one(user, {
    fields: [platformVisits.userId],
    references: [user.id],
  }),
}));
