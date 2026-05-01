import { relations } from "drizzle-orm";
import {
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { userGroups } from "./groups";

// ─── Labs ────────────────────────────────────────────────────────────────────
// One lab per semester: OOPS → 1, PPS → 2, DS → 3, DAA → 4

export const labs = pgTable("labs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),             // e.g. "OOPS Lab"
  semester: integer("semester").notNull(),  // 1 | 2 | 3 | 4
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ─── Exercises ───────────────────────────────────────────────────────────────
// 12 exercises per lab
// No startTime/endTime here — that's handled per group in exercise_groups

export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    labId: uuid("lab_id")
      .notNull()
      .references(() => labs.id, { onDelete: "cascade" }),
    exerciseNo: integer("exercise_no").notNull(), // 1–12
    title: text("title").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.labId, t.exerciseNo)],
);

// ─── Exercise Groups ─────────────────────────────────────────────────────────
// Each group gets its own time window per exercise
// Mirrors the exact same pattern as your existing exam_groups table

export const exerciseGroups = pgTable(
  "exercise_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => userGroups.id, { onDelete: "cascade" }),
    startTime: timestamp("start_time").notNull(),
    endTime: timestamp("end_time").notNull(),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.exerciseId, t.groupId)],
);

// ─── Programs ────────────────────────────────────────────────────────────────
// 7–8 programs per exercise (the actual tasks students solve)

export const labPrograms = pgTable(
  "lab_programs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    programNo: integer("program_no").notNull(), // 1–8
    title: text("title").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.exerciseId, t.programNo)],
);

// ─── Lab Submissions ─────────────────────────────────────────────────────────
// Tracks which programs each student has solved
// Kept separate from the existing exam submissions table intentionally

export const labSubmissions = pgTable(
  "lab_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    programId: uuid("program_id")
      .notNull()
      .references(() => labPrograms.id, { onDelete: "cascade" }),
    solvedAt: timestamp("solved_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.userId, t.programId)],
);

// ─── Exercise Marks ──────────────────────────────────────────────────────────
// Computed marks per student per exercise
// Upsert here whenever a student solves a program

export const exerciseMarks = pgTable(
  "exercise_marks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    marks: numeric("marks", { precision: 5, scale: 2 }).notNull().default("0"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [unique().on(t.userId, t.exerciseId)],
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const labsRelations = relations(labs, ({ many }) => ({
  exercises: many(exercises),
}));

export const exercisesRelations = relations(exercises, ({ one, many }) => ({
  lab: one(labs, {
    fields: [exercises.labId],
    references: [labs.id],
  }),
  programs: many(labPrograms),
  marks: many(exerciseMarks),
  groups: many(exerciseGroups),
}));

export const exerciseGroupsRelations = relations(exerciseGroups, ({ one }) => ({
  exercise: one(exercises, {
    fields: [exerciseGroups.exerciseId],
    references: [exercises.id],
  }),
  group: one(userGroups, {
    fields: [exerciseGroups.groupId],
    references: [userGroups.id],
  }),
}));

export const labProgramsRelations = relations(labPrograms, ({ one, many }) => ({
  exercise: one(exercises, {
    fields: [labPrograms.exerciseId],
    references: [exercises.id],
  }),
  submissions: many(labSubmissions),
}));

export const labSubmissionsRelations = relations(labSubmissions, ({ one }) => ({
  user: one(user, {
    fields: [labSubmissions.userId],
    references: [user.id],
  }),
  program: one(labPrograms, {
    fields: [labSubmissions.programId],
    references: [labPrograms.id],
  }),
}));

export const exerciseMarksRelations = relations(exerciseMarks, ({ one }) => ({
  user: one(user, {
    fields: [exerciseMarks.userId],
    references: [user.id],
  }),
  exercise: one(exercises, {
    fields: [exerciseMarks.exerciseId],
    references: [exercises.id],
  }),
}));