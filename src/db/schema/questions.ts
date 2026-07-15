import { relations } from "drizzle-orm";
import {
  boolean,
  json,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { departments } from "./departments";

export const difficultyEnum = pgEnum("difficulty", ["easy", "medium", "hard"]);

export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  departmentId: uuid("department_id").references(() => departments.id, {
    onDelete: "set null",
  }),
  ownerId: text("owner_id"),
  transferredBy: text("transferred_by"),
  transferredAt: timestamp("transferred_at"),
  isPrivate: boolean("is_private").default(true).notNull(),
  title: text("title").notNull(),
  problemStatement: text("problem_statement").notNull(),
  difficulty: difficultyEnum("difficulty").notNull(),
  allowedLanguages: json("allowed_languages").default(["java"]),
  driverCode: json("driver_code")
    .$type<Record<string, string>>()
    .default({ java: "" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const testCases = pgTable("test_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  input: text("input").notNull(),
  expectedOutput: text("expected_output").notNull(),
  isHidden: boolean("is_hidden").default(true).notNull(),
});

export const questionsRelations = relations(questions, ({ many }) => ({
  testCases: many(testCases),
}));

export const testCasesRelations = relations(testCases, ({ one }) => ({
  question: one(questions, {
    fields: [testCases.questionId],
    references: [questions.id],
  }),
}));
