import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  json,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { userGroups } from "./groups";
import { examCollections } from "./question-collections";
import { departments } from "./departments";

export const examStatusEnum = pgEnum("exam_status", [
  "upcoming",
  "active",
  "ended",
]);
export const strategyTypeEnum = pgEnum("strategy_type", [
  "random_n",
  "fixed_set",
  "difficulty_mix",
]);

export interface RandomNStrategyConfig {
  count: number;
  collectionIds: string[];
}

export type FixedSetStrategyConfig = {
  questionIds: string[];
};

export interface DifficultyMixStrategyConfig {
  easy: number;
  medium: number;
  hard: number;
  collectionIds: string[];
}

export type StrategyConfigMap = {
  random_n: RandomNStrategyConfig;
  fixed_set: FixedSetStrategyConfig;
  difficulty_mix: DifficultyMixStrategyConfig;
};

export type StrategyConfig = StrategyConfigMap[keyof StrategyConfigMap];

export const gradingStrategyEnum = pgEnum("grading_strategy", [
  "linear",
  "difficulty_based",
  "count_based",
]);

export type CountBasedStrategyConfig = {
  thresholds: { count: number; marks: number }[];
};

export type GradingConfigMap = {
  linear: { totalMarks: number };
  difficulty_based: {
    easyWeight: number;
    mediumWeight: number;
    hardWeight: number;
  };
  count_based: CountBasedStrategyConfig;
};

export const exams = pgTable("exams", {
  id: uuid("id").primaryKey().defaultRandom(),
  departmentId: uuid("department_id").references(() => departments.id, {
    onDelete: "set null",
  }),
  ownerId: text("owner_id"),
  transferredBy: text("transferred_by"),
  transferredAt: timestamp("transferred_at"),
  isPrivate: boolean("is_private").default(true).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  requiresPin: boolean("requires_pin").default(false).notNull(),
  status: examStatusEnum("status").default("upcoming").notNull(),
  strategyType: strategyTypeEnum("strategy_type").default("random_n").notNull(),
  gradingStrategy: gradingStrategyEnum("grading_strategy")
    .default("linear")
    .notNull(),
  strategyConfig: json("strategy_config").$type<StrategyConfig>(),
  gradingConfig:
    json("grading_config").$type<GradingConfigMap[keyof GradingConfigMap]>(),
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
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  pin: text("pin"),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
});

export const examModerators = pgTable(
  "exam_moderators",
  {
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    addedBy: text("added_by").notNull(),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.examId, t.userId] })],
);

export const examsRelations = relations(exams, ({ many }) => ({
  groups: many(examGroups),
  collections: many(examCollections),
  moderators: many(examModerators),
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

export const examModeratorsRelations = relations(examModerators, ({ one }) => ({
  exam: one(exams, {
    fields: [examModerators.examId],
    references: [exams.id],
  }),
  user: one(user, {
    fields: [examModerators.userId],
    references: [user.id],
  }),
}));
