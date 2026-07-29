"use server";

import { db } from "@/db";
import {
  exercises,
  labSubmissions,
  exerciseMarks,
  exerciseAttendance,
  exerciseGroups,
  labGroupFaculty,
} from "@/db/schema/labs";
import { userGroups, userGroupMembers } from "@/db/schema/groups";
import { eq, count, countDistinct, inArray, and } from "drizzle-orm";
import { ensureEntityPermission, checkAwardMarksWindow, requireUser } from "@/lib/auth-access";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FacultyLabOverviewResult = {
  success: boolean;
  data?: {
    id: string;
    name: string;
    semester: number;
    exercises: {
      id: string;
      exerciseNo: number;
      title: string;
      description: string | null;
      programCount: number;
      submissionCount: number;
    }[];
  }[];
  error?: string;
};

export type ExerciseSubmissionsResult = {
  success: boolean;
  data?: {
    exercise: {
      id: string;
      exerciseNo: number;
      title: string;
      maxMarks: number;
      programs: { id: string; programNo: number; title: string }[];
    };
    students: {
      id: string;
      name: string;
      email: string;
      username: string | null;
      solvedProgramIds: string[];
      marks: number | null;
      implementationMarks: number | null;
      writeUpMarks: number | null;
      vivaMarks: number | null;
    }[];
  };
  error?: string;
};

// ---------------------------------------------------------------------------
// getFacultyLabOverview
// ---------------------------------------------------------------------------

export async function getFacultyLabOverview(): Promise<FacultyLabOverviewResult> {
  try {
    await ensureEntityPermission({ entity: "labs", action: "read" });

    const allLabs = await db.query.labs.findMany({
      orderBy: (l, { asc }) => [asc(l.semester)],
      with: {
        exercises: {
          orderBy: (e, { asc }) => [asc(e.exerciseNo)],
          with: {
            collection: {
              with: {
                questions: true,
              },
            },
          },
        },
      },
    });

    const data = await Promise.all(
      allLabs.map(async (lab) => ({
        id: lab.id,
        name: lab.name,
        semester: lab.semester,
        exercises: await Promise.all(
          lab.exercises.map(async (ex) => {
            const programIds = (ex.collection?.questions ?? []).map((q) => q.questionId);
            let submissionCount = 0;
            if (programIds.length > 0) {
              const [row] = await db
                .select({ value: countDistinct(labSubmissions.userId) })
                .from(labSubmissions)
                .where(inArray(labSubmissions.programId, programIds));
              submissionCount = row?.value ?? 0;
            }

            return {
              id: ex.id,
              exerciseNo: ex.exerciseNo,
              title: ex.title,
              description: ex.description ?? null,
              programCount: programIds.length,
              submissionCount,
            };
          })
        ),
      }))
    );

    return { success: true, data };
  } catch (err) {
    console.error("[getFacultyLabOverview]", err);
    return { success: false, error: "Failed to load lab overview" };
  }
}

// ---------------------------------------------------------------------------
// getExerciseSubmissions
// ---------------------------------------------------------------------------

export async function getExerciseSubmissions(
  exerciseId: string,
  filterGroupId?: string
): Promise<ExerciseSubmissionsResult> {
  try {
    const session = await requireUser();
    await ensureEntityPermission({ entity: "labs", action: "read" });

    let allowedStudentIds: Set<string> | null = null;

    if (session.user.role === "faculty") {
      const ex = await db.query.exercises.findFirst({
        where: eq(exercises.id, exerciseId),
        columns: { labId: true },
      });

      if (!ex) {
        return {
          success: true,
          data: {
            exercise: { id: exerciseId, exerciseNo: 0, title: "", maxMarks: 20, programs: [] },
            students: [],
          },
        };
      }

      // Faculty can only see students from groups assigned to them for this lab
      const assigned = await db.query.labGroupFaculty.findMany({
        where: and(
          eq(labGroupFaculty.labId, ex.labId),
          eq(labGroupFaculty.facultyId, session.user.id)
        ),
      });

      const assignedGroupIds = assigned.map((a) => a.groupId);
      if (assignedGroupIds.length === 0) {
        return {
          success: true,
          data: {
            exercise: { id: exerciseId, exerciseNo: 0, title: "", maxMarks: 20, programs: [] },
            students: [],
          },
        };
      }

      const targetGroupIds = filterGroupId && filterGroupId !== "all"
        ? (assignedGroupIds.includes(filterGroupId) ? [filterGroupId] : [])
        : assignedGroupIds;

      if (targetGroupIds.length > 0) {
        const members = await db.query.userGroupMembers.findMany({
          where: inArray(userGroupMembers.groupId, targetGroupIds),
        });
        allowedStudentIds = new Set(members.map((m) => m.userId));
      }
    } else if (filterGroupId && filterGroupId !== "all") {
      const members = await db.query.userGroupMembers.findMany({
        where: eq(userGroupMembers.groupId, filterGroupId),
      });
      allowedStudentIds = new Set(members.map((m) => m.userId));
    }

    // Load exercise + its programs
    const exercise = await db.query.exercises.findFirst({
      where: eq(exercises.id, exerciseId),
      with: {
        collection: {
          with: {
            questions: {
              with: { question: true },
              orderBy: (cq, { asc }) => [asc(cq.addedAt)],
            },
          },
        },
      },
    });

    if (!exercise) return { success: false, error: "Exercise not found" };

    // Map collection questions to programs shape
    const programList = (exercise.collection?.questions ?? [])
      .filter((cq) => cq.question != null)
      .map((cq, idx) => ({
        id: cq.questionId,
        programNo: idx + 1,
        title: cq.question.title,
      }));

    // Load all submissions for this exercise
    const programIds = programList.map((p) => p.id);
    let submissions =
      programIds.length > 0
        ? await db.query.labSubmissions.findMany({
            where: and(
              eq(labSubmissions.exerciseId, exerciseId),
              inArray(labSubmissions.programId, programIds)
            ),
            with: {
              user: {
                columns: {
                  id: true,
                  name: true,
                  email: true,
                  username: true,
                  section: true,
                  semester: true,
                },
              },
            },
          })
        : [];

    if (allowedStudentIds) {
      submissions = submissions.filter((s) => allowedStudentIds!.has(s.userId));
    }

    // Load all marks for this exercise
    let marks = await db.query.exerciseMarks.findMany({
      where: eq(exerciseMarks.exerciseId, exerciseId),
    });

    if (allowedStudentIds) {
      marks = marks.filter((m) => allowedStudentIds!.has(m.userId));
    }

    // Group submissions by student
    const studentMap = new Map<
      string,
      {
        id: string;
        name: string;
        email: string;
        username: string | null;
        solvedProgramIds: string[];
        marks: number | null;
        implementationMarks: number | null;
        writeUpMarks: number | null;
        vivaMarks: number | null;
      }
    >();

    for (const sub of submissions) {
      const sid = sub.userId;
      if (!studentMap.has(sid)) {
        studentMap.set(sid, {
          id: sid,
          name: sub.user?.name ?? "Unknown",
          email: sub.user?.email ?? "",
          username: sub.user?.username ?? null,
          solvedProgramIds: [],
          marks: null,
          implementationMarks: null,
          writeUpMarks: null,
          vivaMarks: null,
        });
      }
      if (sub.programId !== "00000000-0000-0000-0000-000000000000") {
        studentMap.get(sid)!.solvedProgramIds.push(sub.programId);
      }
    }

    // Attach marks
    for (const m of marks) {
      const entry = studentMap.get(m.userId);
      if (entry) {
        entry.marks = parseFloat(m.marks);
        entry.implementationMarks = m.implementationMarks !== null ? parseFloat(m.implementationMarks) : null;
        entry.writeUpMarks = m.writeUpMarks !== null ? parseFloat(m.writeUpMarks) : null;
        entry.vivaMarks = m.vivaMarks !== null ? parseFloat(m.vivaMarks) : null;
      }
    }

    // Nullify marks for students marked absent
    const studentIds = Array.from(studentMap.keys());
    if (studentIds.length > 0) {
      const attendanceRecords = await db.query.exerciseAttendance.findMany({
        where: and(
          eq(exerciseAttendance.exerciseId, exerciseId),
          inArray(exerciseAttendance.userId, studentIds),
        ),
      });
      const absentStudentSet = new Set(
        attendanceRecords.filter((a) => !a.present).map((a) => a.userId),
      );

      for (const absentId of absentStudentSet) {
        const entry = studentMap.get(absentId);
        if (entry) {
          entry.marks = null;
          entry.implementationMarks = null;
          entry.writeUpMarks = null;
          entry.vivaMarks = null;
        }
      }
    }

    return {
      success: true,
      data: {
        exercise: {
          id: exercise.id,
          exerciseNo: exercise.exerciseNo,
          title: exercise.title,
          maxMarks: parseFloat(String(exercise.maxMarks ?? 10)),
          programs: programList,
        },
        students: Array.from(studentMap.values()),
      },
    };
  } catch (err) {
    console.error("[getExerciseSubmissions]", err);
    return { success: false, error: "Failed to load submissions" };
  }
}

// ---------------------------------------------------------------------------
// awardMarks
// ---------------------------------------------------------------------------

export async function awardMarks({
  studentId,
  exerciseId,
  implementationMarks,
  writeUpMarks,
  vivaMarks,
  marks,
}: {
  studentId: string;
  exerciseId: string;
  implementationMarks?: number;
  writeUpMarks?: number;
  vivaMarks?: number;
  marks?: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await ensureEntityPermission({ entity: "labs", action: "update" });

    if (access.session.user.role === "faculty") {
      const windowCheck = await checkAwardMarksWindow(studentId, exerciseId);
      if (!windowCheck.allowed) {
        return { success: false, error: windowCheck.reason ?? "Grading period has expired" };
      }
    }

    const attendanceRecord = await db.query.exerciseAttendance.findFirst({
      where: and(
        eq(exerciseAttendance.exerciseId, exerciseId),
        eq(exerciseAttendance.userId, studentId),
      ),
      columns: { present: true },
    });
    if (attendanceRecord && !attendanceRecord.present) {
      return {
        success: false,
        error: "Cannot award marks to a student marked absent",
      };
    }

    const hasDetailed = implementationMarks !== undefined && writeUpMarks !== undefined && vivaMarks !== undefined;
    const total = hasDetailed ? (implementationMarks! + writeUpMarks! + vivaMarks!) : (marks ?? 0);

    await db
      .insert(exerciseMarks)
      .values({
        userId: studentId,
        exerciseId,
        implementationMarks: hasDetailed ? String(implementationMarks) : null,
        writeUpMarks: hasDetailed ? String(writeUpMarks) : null,
        vivaMarks: hasDetailed ? String(vivaMarks) : null,
        marks: String(total),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [exerciseMarks.userId, exerciseMarks.exerciseId],
        set: {
          implementationMarks: hasDetailed ? String(implementationMarks) : null,
          writeUpMarks: hasDetailed ? String(writeUpMarks) : null,
          vivaMarks: hasDetailed ? String(vivaMarks) : null,
          marks: String(total),
          updatedAt: new Date(),
        },
      });

    return { success: true };
  } catch (err) {
    console.error("[awardMarks]", err);
    return { success: false, error: "Failed to award marks" };
  }
}

// ---------------------------------------------------------------------------
// getExerciseAttendance
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// getExerciseAttendance
// ---------------------------------------------------------------------------

export async function getExerciseAttendance(
  exerciseId: string,
  filterGroupId?: string,
): Promise<{
  success: boolean;
  data?: {
    attendancePosted: boolean;
    students: {
      id: string;
      name: string;
      email: string;
      username: string | null;
      present: boolean;
    }[];
  };
  error?: string;
}> {
  try {
    const session = await requireUser();
    await ensureEntityPermission({ entity: "labs", action: "update" });

    // Load exercise for attendancePosted flag + its groups
    const exercise = await db.query.exercises.findFirst({
      where: eq(exercises.id, exerciseId),
      columns: { labId: true, attendancePosted: true },
      with: { groups: { columns: { groupId: true } } },
    });

    if (!exercise) return { success: false, error: "Exercise not found" };

    let groupIds = exercise.groups.map((g) => g.groupId);

    if (session.user.role === "faculty") {
      const assigned = await db.query.labGroupFaculty.findMany({
        where: and(
          eq(labGroupFaculty.labId, exercise.labId),
          eq(labGroupFaculty.facultyId, session.user.id),
        ),
      });
      const assignedGroupIds = assigned.map((a) => a.groupId);
      groupIds = groupIds.filter((id) => assignedGroupIds.includes(id));
    }

    if (filterGroupId && filterGroupId !== "all") {
      groupIds = groupIds.filter((id) => id === filterGroupId);
    }

    if (groupIds.length === 0) {
      return {
        success: true,
        data: { attendancePosted: exercise.attendancePosted, students: [] },
      };
    }

    // Fetch all members in those groups
    const members = await db.query.userGroupMembers.findMany({
      where: inArray(userGroupMembers.groupId, groupIds),
      with: {
        user: {
          columns: { id: true, name: true, email: true, username: true },
        },
      },
    });

    // Deduplicate by userId (student may be in multiple groups)
    const studentMap = new Map<
      string,
      { id: string; name: string; email: string; username: string | null }
    >();
    for (const m of members) {
      if (m.user && !studentMap.has(m.userId)) {
        studentMap.set(m.userId, {
          id: m.userId,
          name: m.user.name,
          email: m.user.email,
          username: m.user.username ?? null,
        });
      }
    }

    // Fetch current attendance records for these students
    const studentIds = Array.from(studentMap.keys());
    let presentSet = new Set<string>();

    if (studentIds.length > 0) {
      const attendanceRecords = await db.query.exerciseAttendance.findMany({
        where: and(
          eq(exerciseAttendance.exerciseId, exerciseId),
          inArray(exerciseAttendance.userId, studentIds),
        ),
      });
      presentSet = new Set(
        attendanceRecords.filter((a) => a.present).map((a) => a.userId),
      );
    }

    const students = Array.from(studentMap.values()).map((s) => ({
      ...s,
      present: presentSet.has(s.id),
    }));

    return {
      success: true,
      data: { attendancePosted: exercise.attendancePosted, students },
    };
  } catch (err) {
    console.error("[getExerciseAttendance]", err);
    return { success: false, error: "Failed to load attendance" };
  }
}

// ---------------------------------------------------------------------------
// saveAttendance
// ---------------------------------------------------------------------------

export async function saveAttendance({
  exerciseId,
  presentStudentIds,
  filterGroupId,
}: {
  exerciseId: string;
  presentStudentIds: string[];
  filterGroupId?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireUser();
    await ensureEntityPermission({ entity: "labs", action: "update" });

    // Get all groups for this exercise
    const exercise = await db.query.exercises.findFirst({
      where: eq(exercises.id, exerciseId),
      columns: { id: true, labId: true },
      with: { groups: { columns: { groupId: true } } },
    });
    if (!exercise) return { success: false, error: "Exercise not found" };

    let groupIds = exercise.groups.map((g) => g.groupId);

    if (session.user.role === "faculty") {
      const assigned = await db.query.labGroupFaculty.findMany({
        where: and(
          eq(labGroupFaculty.labId, exercise.labId),
          eq(labGroupFaculty.facultyId, session.user.id),
        ),
      });
      const assignedGroupIds = assigned.map((a) => a.groupId);
      groupIds = groupIds.filter((id) => assignedGroupIds.includes(id));
    }

    if (filterGroupId && filterGroupId !== "all") {
      groupIds = groupIds.filter((id) => id === filterGroupId);
    }

    if (groupIds.length === 0) return { success: true };

    const members = await db.query.userGroupMembers.findMany({
      where: inArray(userGroupMembers.groupId, groupIds),
      columns: { userId: true },
    });

    const targetStudentIds = [...new Set(members.map((m) => m.userId))];
    const presentSet = new Set(presentStudentIds);
    const absentIds = targetStudentIds.filter((id) => !presentSet.has(id));

    // Upsert attendance for target section students
    if (targetStudentIds.length > 0) {
      await db
        .insert(exerciseAttendance)
        .values(
          targetStudentIds.map((userId) => ({
            exerciseId,
            userId,
            present: presentSet.has(userId),
            markedAt: new Date(),
          })),
        )
        .onConflictDoUpdate({
          target: [exerciseAttendance.exerciseId, exerciseAttendance.userId],
          set: {
            present: false,
            markedAt: new Date(),
          },
        });

      if (presentStudentIds.length > 0) {
        await db
          .insert(exerciseAttendance)
          .values(
            presentStudentIds.map((userId) => ({
              exerciseId,
              userId,
              present: true,
              markedAt: new Date(),
            })),
          )
          .onConflictDoUpdate({
            target: [exerciseAttendance.exerciseId, exerciseAttendance.userId],
            set: { present: true, markedAt: new Date() },
          });
      }
    }

    revalidatePath("/faculty/labs");
    return { success: true };
  } catch (err) {
    console.error("[saveAttendance]", err);
    return { success: false, error: "Failed to save attendance" };
  }
}

// ---------------------------------------------------------------------------
// postAttendance
// ---------------------------------------------------------------------------

export async function postAttendance(
  exerciseId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureEntityPermission({ entity: "labs", action: "update" });

    await db
      .update(exercises)
      .set({ attendancePosted: true })
      .where(eq(exercises.id, exerciseId));

    revalidatePath("/faculty/labs");
    return { success: true };
  } catch (err) {
    console.error("[postAttendance]", err);
    return { success: false, error: "Failed to post attendance" };
  }
}

// ---------------------------------------------------------------------------
// getAvailableSectionsForExercise
// ---------------------------------------------------------------------------

export async function getAvailableSectionsForExercise(
  exerciseId: string
): Promise<{ id: string; name: string }[]> {
  try {
    const session = await requireUser();
    const ex = await db.query.exercises.findFirst({
      where: eq(exercises.id, exerciseId),
      columns: { labId: true },
      with: {
        groups: {
          with: {
            group: { columns: { id: true, name: true } },
          },
        },
      },
    });

    if (!ex) return [];

    let availableGroupIds: string[] = ex.groups.map((g) => g.groupId);

    if (session.user.role === "faculty") {
      const assigned = await db.query.labGroupFaculty.findMany({
        where: and(
          eq(labGroupFaculty.labId, ex.labId),
          eq(labGroupFaculty.facultyId, session.user.id)
        ),
      });
      const assignedGroupIds = assigned.map((a) => a.groupId);
      availableGroupIds = availableGroupIds.filter((id) =>
        assignedGroupIds.includes(id)
      );
    }

    if (availableGroupIds.length === 0) {
      // Fallback: fetch all section groups for admin or unassigned exercise
      const allGroups = await db.query.userGroups.findMany({ limit: 100 });
      return allGroups
        .filter((g) => {
          const lower = g.name.trim().toLowerCase();
          return lower !== "all" && lower !== "all users" && lower !== "all user";
        })
        .map((g) => ({ id: g.id, name: g.name }));
    }

    const matchedGroups = ex.groups
      .filter((g) => availableGroupIds.includes(g.groupId))
      .map((g) => ({ id: g.group.id, name: g.group.name }))
      .filter((g) => {
        const lower = g.name.trim().toLowerCase();
        return lower !== "all" && lower !== "all users" && lower !== "all user";
      });

    return matchedGroups.length > 0
      ? matchedGroups
      : (await db.query.userGroups.findMany({ limit: 100 }))
          .filter((g) => {
            const lower = g.name.trim().toLowerCase();
            return lower !== "all" && lower !== "all users" && lower !== "all user";
          })
          .map((g) => ({ id: g.id, name: g.name }));
  } catch (err) {
    console.error("[getAvailableSectionsForExercise]", err);
    return [];
  }
}