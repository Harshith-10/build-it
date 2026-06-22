import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const departmentUsers = pgTable("department_users", {
  departmentId: uuid("department_id")
    .notNull()
    .references(() => departments.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const departmentsRelations = relations(departments, ({ many }) => ({
  users: many(departmentUsers),
}));

export const departmentUsersRelations = relations(
  departmentUsers,
  ({ one }) => ({
    department: one(departments, {
      fields: [departmentUsers.departmentId],
      references: [departments.id],
    }),
    user: one(user, {
      fields: [departmentUsers.userId],
      references: [user.id],
    }),
  }),
);
