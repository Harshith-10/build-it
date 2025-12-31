import { relations } from "drizzle-orm";
import {
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { exams } from "./exams";
import { questions } from "./questions";

export const questionCollections = pgTable("question_collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  tags: json("tags").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const collectionQuestions = pgTable(
  "collection_questions",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => questionCollections.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.questionId] })],
);

export const examCollections = pgTable(
  "exam_collections",
  {
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => questionCollections.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.examId, t.collectionId] })],
);

// Relations

export const questionCollectionsRelations = relations(
  questionCollections,
  ({ many }) => ({
    questions: many(collectionQuestions),
    exams: many(examCollections),
  }),
);

export const collectionQuestionsRelations = relations(
  collectionQuestions,
  ({ one }) => ({
    collection: one(questionCollections, {
      fields: [collectionQuestions.collectionId],
      references: [questionCollections.id],
    }),
    question: one(questions, {
      fields: [collectionQuestions.questionId],
      references: [questions.id],
    }),
  }),
);

export const examCollectionsRelations = relations(
  examCollections,
  ({ one }) => ({
    exam: one(exams, {
      fields: [examCollections.examId],
      references: [exams.id],
    }),
    collection: one(questionCollections, {
      fields: [examCollections.collectionId],
      references: [questionCollections.id],
    }),
  }),
);
