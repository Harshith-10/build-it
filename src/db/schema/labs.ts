import { relations } from "drizzle-orm";
import {
  boolean,
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
import { questionCollections } from "./question-collections"; // ✅ added

// ─── Labs ────────────────────────────────────────────────────────────────────

export const labs = pgTable("labs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // e.g. "OOPS Lab"
  code: text("code"), // e.g. "AH2105" or "CS301"
  semester: integer("semester").notNull(), // 1 | 2 | 3 | 4
  branch: text("branch").notNull().default("CSE"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ─── Exercises ───────────────────────────────────────────────────────────────

export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    labId: uuid("lab_id")
      .notNull()
      .references(() => labs.id, { onDelete: "cascade" }),
    exerciseNo: integer("exercise_no").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    // ✅ one collection per exercise — programs come from here
    collectionId: uuid("collection_id").references(
      () => questionCollections.id,
      { onDelete: "set null" }
    ),
    maxMarks: numeric("max_marks", { precision: 5, scale: 2 })
      .notNull()
      .default("20"),
    attendancePosted: boolean("attendance_posted").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.labId, t.exerciseNo)]
);

// ─── Exercise Attendance ──────────────────────────────────────────────────────

export const exerciseAttendance = pgTable(
  "exercise_attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    present: boolean("present").notNull().default(false),
    markedAt: timestamp("marked_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.exerciseId, t.userId)]
);

// ─── Exercise Groups ─────────────────────────────────────────────────────────

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
  (t) => [unique().on(t.exerciseId, t.groupId)]
);

// ─── Lab Group Faculty ───────────────────────────────────────────────────────
// Maps which faculty member handles a specific lab for a specific group/section.

export const labGroupFaculty = pgTable(
  "lab_group_faculty",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    labId: uuid("lab_id")
      .notNull()
      .references(() => labs.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => userGroups.id, { onDelete: "cascade" }),
    facultyId: text("faculty_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.labId, t.groupId, t.facultyId)]
);

// ─── Lab Submissions ─────────────────────────────────────────────────────────
// programId = question id from the linked collection

export const labSubmissions = pgTable(
  "lab_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    programId: uuid("program_id").notNull(), // question id from collection
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    solvedAt: timestamp("solved_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.userId, t.programId, t.exerciseId)]
);

// ─── Exercise Marks ──────────────────────────────────────────────────────────

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
    implementationMarks: numeric("implementation_marks", { precision: 5, scale: 2 }),
    writeUpMarks: numeric("write_up_marks", { precision: 5, scale: 2 }),
    vivaMarks: numeric("viva_marks", { precision: 5, scale: 2 }),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [unique().on(t.userId, t.exerciseId)]
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const labsRelations = relations(labs, ({ many }) => ({
  exercises: many(exercises),
  facultyAssignments: many(labGroupFaculty),
}));

export const exercisesRelations = relations(exercises, ({ one, many }) => ({
  lab: one(labs, {
    fields: [exercises.labId],
    references: [labs.id],
  }),
  // ✅ relation to collection
  collection: one(questionCollections, {
    fields: [exercises.collectionId],
    references: [questionCollections.id],
  }),
  marks: many(exerciseMarks),
  groups: many(exerciseGroups),
  submissions: many(labSubmissions),
  attendance: many(exerciseAttendance),
}));

export const exerciseAttendanceRelations = relations(exerciseAttendance, ({ one }) => ({
  exercise: one(exercises, {
    fields: [exerciseAttendance.exerciseId],
    references: [exercises.id],
  }),
  user: one(user, {
    fields: [exerciseAttendance.userId],
    references: [user.id],
  }),
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

export const labGroupFacultyRelations = relations(labGroupFaculty, ({ one }) => ({
  lab: one(labs, {
    fields: [labGroupFaculty.labId],
    references: [labs.id],
  }),
  group: one(userGroups, {
    fields: [labGroupFaculty.groupId],
    references: [userGroups.id],
  }),
  faculty: one(user, {
    fields: [labGroupFaculty.facultyId],
    references: [user.id],
  }),
}));

export const labSubmissionsRelations = relations(labSubmissions, ({ one }) => ({
  user: one(user, {
    fields: [labSubmissions.userId],
    references: [user.id],
  }),
  exercise: one(exercises, {
    fields: [labSubmissions.exerciseId],
    references: [exercises.id],
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
