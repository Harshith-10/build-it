import { relations } from "drizzle-orm";
import {
  integer,
  json,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { userGroups } from "./groups";

export const examStatusEnum = pgEnum("exam_status", [
  "upcoming",
  "active",
  "ended",
]);
export const strategyTypeEnum = pgEnum("strategy_type", [
  "random_3",
  "fixed_set",
  "difficulty_mix",
]);
export const gradingStrategyEnum = pgEnum("grading_strategy", [
  "standard_20_40_50",
  "linear",
]);

export const exams = pgTable("exams", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  status: examStatusEnum("status").default("upcoming").notNull(),
  strategyType: strategyTypeEnum("strategy_type").default("random_3").notNull(),
  gradingStrategy: gradingStrategyEnum("grading_strategy")
    .default("standard_20_40_50")
    .notNull(),
  strategyConfig: json("strategy_config"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const examGroups = pgTable("exam_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  examId: uuid("exam_id")
    .notNull()
    .references(() => exams.id, { onDelete: "cascade" }),
  groupId: uuid("group_id")
    .notNull()
    .references(() => userGroups.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
});

export const examsRelations = relations(exams, ({ many }) => ({
  groups: many(examGroups),
}));

export const examGroupsRelations = relations(examGroups, ({ one }) => ({
  exam: one(exams, {
    fields: [examGroups.examId],
    references: [exams.id],
  }),
  group: one(userGroups, {
    fields: [examGroups.groupId],
    references: [userGroups.id],
  }),
}));
