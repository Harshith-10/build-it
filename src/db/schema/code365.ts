// src/db/schema/code365.ts
import { pgTable, text, timestamp, integer, uuid, date } from "drizzle-orm/pg-core";
import { user } from "./auth"; // Your auth schema
import { questions } from "./questions";

// 1. The Daily Problems Table
export const code365Problems = pgTable("code365_problems", {
  id: uuid("id").primaryKey().defaultRandom(),
  originalQuestionId: uuid("original_question_id").references(() => questions.id),
  title: text("title").notNull(),
  description: text("description"),
  difficulty: text("difficulty").notNull(), 
  tags: text("tags").array().notNull(), 
  estimatedMinutes: integer("estimated_minutes").notNull(),
  dateAssigned: date("date_assigned").notNull().unique(), 
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 2. User Stats Table (CHANGED userId to text)
export const code365UserStats = pgTable("code365_user_stats", {
  userId: text("user_id").primaryKey().references(() => user.id), // <--- Changed here
  currentStreak: integer("current_streak").default(0).notNull(),
  freezesAvailable: integer("freezes_available").default(3).notNull(), 
  streakHistory: date("streak_history").array().notNull().default([]), 
  lastSolvedDate: date("last_solved_date"), 
});

// 3. Submissions Table (CHANGED userId to text)
export const code365Submissions = pgTable("code365_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => user.id).notNull(), // <--- Changed here
  problemId: uuid("problem_id").references(() => code365Problems.id).notNull(),
  solvedAt: timestamp("solved_at").defaultNow().notNull(),
});