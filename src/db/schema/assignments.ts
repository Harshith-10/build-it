import { relations } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { exams } from "./exams";
import { questions } from "./questions";

export const assignmentStatusEnum = pgEnum("assignment_status", [
  "not_started",
  "in_progress",
  "completed",
]);
export const submissionVerdictEnum = pgEnum("submission_verdict", [
  "passed",
  "failed",
  "compile_error",
  "runtime_error",
]);

export const examAssignments = pgTable("exam_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  examId: uuid("exam_id")
    .notNull()
    .references(() => exams.id, { onDelete: "cascade" }),
  assignedQuestionIds: jsonb("assigned_question_ids")
    .$type<string[]>()
    .notNull(),
  status: assignmentStatusEnum("status").default("not_started").notNull(),
  score: integer("score").default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  assignmentId: uuid("assignment_id")
    .notNull()
    .references(() => examAssignments.id, { onDelete: "cascade" }),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  verdict: submissionVerdictEnum("verdict").notNull(),
  testCasesPassed: integer("test_cases_passed").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const examAssignmentsRelations = relations(
  examAssignments,
  ({ one, many }) => ({
    user: one(user, {
      fields: [examAssignments.userId],
      references: [user.id],
    }),
    exam: one(exams, {
      fields: [examAssignments.examId],
      references: [exams.id],
    }),
    submissions: many(submissions),
  }),
);

export const submissionsRelations = relations(submissions, ({ one }) => ({
  assignment: one(examAssignments, {
    fields: [submissions.assignmentId],
    references: [examAssignments.id],
  }),
  question: one(questions, {
    fields: [submissions.questionId],
    references: [questions.id],
  }),
}));
