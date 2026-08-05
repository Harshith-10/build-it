"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  labs,
  exercises,
  exerciseGroups,
  labGroupFaculty,
  labSubmissions,
  exerciseMarks,
  exerciseAttendance,
} from "@/db/schema/labs";
import { user } from "@/db/schema/auth";
import {
  userGroups,
  userGroupMembers,
} from "@/db/schema/groups";
import {
  checkEntityPermission,
  requireUser,
  requireAdmin,
  checkAwardMarksWindow,
} from "@/lib/auth-access";

// ─── Labs ─────────────────────────────────────────────────────────────────────

export async function getLabs() {
  const session = await requireUser();

  if (session.user.role === "faculty") {
    const assignments = await db.query.labGroupFaculty.findMany({
      where: eq(labGroupFaculty.facultyId, session.user.id),
      columns: { labId: true },
    });

    const assignedLabIds = Array.from(new Set(assignments.map((a) => a.labId)));

    if (assignedLabIds.length === 0) {
      return [];
    }

    return db.query.labs.findMany({
      where: inArray(labs.id, assignedLabIds),
      orderBy: (l, { asc }) => [asc(l.name)],
      with: { exercises: true },
    });
  }

  return db.query.labs.findMany({
    orderBy: (l, { asc }) => [asc(l.name)],
    with: { exercises: true },
  });
}

export async function createLab(data: {
  name: string;
  semester?: number;
  branch?: string;
  description?: string;
}) {
  try {
    await requireAdmin();

    const existing = await db.query.labs.findFirst({
      where: sql`lower(${labs.name}) = lower(${data.name})`,
    });
    if (existing) {
      return { success: false, error: `A lab named "${existing.name}" already exists.` };
    }

    const [newLab] = await db
      .insert(labs)
      .values({
        name: data.name,
        semester: data.semester ?? 1,
        branch: (data.branch ?? "CSE").trim().toUpperCase(),
        description: data.description,
      })
      .returning();
    revalidatePath("/admin/labs");
    revalidatePath("/faculty/labs");
    return { success: true, lab: newLab };
  } catch (error) {
    console.error("Failed to create lab:", error);
    return { success: false, error: "Permission denied or failed to create lab" };
  }
}

export async function updateLab(data: {
  id: string;
  name?: string;
  semester?: number;
  branch?: string;
  description?: string;
}) {
  try {
    await requireAdmin();

    if (data.name) {
      const duplicate = await db.query.labs.findFirst({
        where: and(
          sql`lower(${labs.name}) = lower(${data.name})`,
          sql`${labs.id} != ${data.id}`
        ),
      });
      if (duplicate) {
        return { success: false, error: `A lab named "${duplicate.name}" already exists.` };
      }
    }

    const { id, branch, ...rest } = data;
    const updateValues: Record<string, any> = { ...rest };
    if (branch !== undefined) {
      updateValues.branch = branch.trim().toUpperCase();
    }

    const [updated] = await db
      .update(labs)
      .set(updateValues)
      .where(eq(labs.id, id))
      .returning();

    if (!updated) return { success: false, error: "Lab not found" };

    revalidatePath("/admin/labs");
    revalidatePath("/faculty/labs");
    return { success: true, lab: updated };
  } catch (error) {
    console.error("Failed to update lab:", error);
    return { success: false, error: "Permission denied or failed to update lab" };
  }
}

export async function deleteLab(id: string) {
  try {
    await requireAdmin();
    await db.delete(labs).where(eq(labs.id, id));
    revalidatePath("/admin/labs");
    revalidatePath("/faculty/labs");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete lab:", error);
    return { success: false, error: "Permission denied or failed to delete lab" };
  }
}

// ─── Exercises ────────────────────────────────────────────────────────────────

export async function getExercises(labId: string) {
  const session = await requireUser();

  const allExercises = await db.query.exercises.findMany({
    where: eq(exercises.labId, labId),
    orderBy: (exercises, { asc }) => [asc(exercises.exerciseNo)],
    with: { groups: true, collection: true },
  });

  // Faculty: filter exercise groups to only their assigned sections
  if (session.user.role === "faculty") {
    const assigned = await db.query.labGroupFaculty.findMany({
      where: and(
        eq(labGroupFaculty.labId, labId),
        eq(labGroupFaculty.facultyId, session.user.id)
      ),
      columns: { groupId: true },
    });
    const assignedGroupIds = new Set(assigned.map((a) => a.groupId));

    return allExercises.map((ex) => ({
      ...ex,
      groups: ex.groups.filter((g) => assignedGroupIds.has(g.groupId)),
    }));
  }

  return allExercises;
}

export async function createExercise(data: {
  labId: string;
  exerciseNo: number;
  title: string;
  description?: string;
  collectionId?: string | null;
}) {
  try {
    await requireAdmin();

    const existing = await db.query.exercises.findMany({
      where: eq(exercises.labId, data.labId),
    });

    const duplicate = existing.find(
      (e) => e.title.trim().toLowerCase() === data.title.trim().toLowerCase()
    );
    if (duplicate) {
      return { success: false, error: `An exercise named "${duplicate.title}" already exists in this lab.` };
    }

    const [newExercise] = await db.insert(exercises).values(data).returning();
    revalidatePath("/admin/labs");
    revalidatePath("/faculty/labs");
    return { success: true, exercise: newExercise };
  } catch (error) {
    console.error("Failed to create exercise:", error);
    return { success: false, error: "Permission denied or failed to create exercise" };
  }
}

export async function updateExercise(data: {
  id: string;
  exerciseNo?: number;
  title?: string;
  description?: string;
  collectionId?: string | null;
}) {
  try {
    await requireAdmin();

    if (data.title) {
      // Fetch the current exercise to get its labId for scoped uniqueness check
      const current = await db.query.exercises.findFirst({
        where: eq(exercises.id, data.id),
      });
      if (!current) return { success: false, error: "Exercise not found" };

      const sibling = await db.query.exercises.findFirst({
        where: and(
          eq(exercises.labId, current.labId),
          sql`lower(${exercises.title}) = lower(${data.title})`,
          sql`${exercises.id} != ${data.id}`
        ),
      });
      if (sibling) {
        return { success: false, error: `An exercise named "${sibling.title}" already exists in this lab.` };
      }
    }

    const { id, ...rest } = data;
    const [updated] = await db
      .update(exercises)
      .set(rest)
      .where(eq(exercises.id, id))
      .returning();

    if (!updated) return { success: false, error: "Exercise not found" };

    revalidatePath("/admin/labs");
    revalidatePath("/faculty/labs");
    return { success: true, exercise: updated };
  } catch (error) {
    console.error("Failed to update exercise:", error);
    return { success: false, error: "Permission denied or failed to update exercise" };
  }
}

export async function deleteExercise(id: string) {
  try {
    await requireAdmin();
    await db.delete(exercises).where(eq(exercises.id, id));
    revalidatePath("/admin/labs");
    revalidatePath("/faculty/labs");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete exercise:", error);
    return { success: false, error: "Permission denied or failed to delete exercise" };
  }
}

// ─── Exercise Groups (Time Windows) ──────────────────────────────────────────

export async function assignExerciseGroup(data: {
  exerciseId: string;
  groupId: string;
  startTime: Date;
  endTime: Date;
}) {
  try {
    const session = await requireUser();
    
    if (session.user.role === "faculty") {
      const ex = await db.query.exercises.findFirst({
        where: eq(exercises.id, data.exerciseId),
        columns: { labId: true },
      });
      if (!ex) return { success: false, error: "Exercise not found" };

      const assigned = await db.query.labGroupFaculty.findFirst({
        where: and(
          eq(labGroupFaculty.labId, ex.labId),
          eq(labGroupFaculty.groupId, data.groupId),
          eq(labGroupFaculty.facultyId, session.user.id)
        ),
      });
      if (!assigned) {
        return { success: false, error: "You are not assigned to this student section/group for this lab." };
      }
    } else if (session.user.role !== "admin") {
      return { success: false, error: "Permission denied" };
    }

    const [assigned] = await db
      .insert(exerciseGroups)
      .values(data)
      .onConflictDoUpdate({
        target: [exerciseGroups.exerciseId, exerciseGroups.groupId],
        set: {
          startTime: data.startTime,
          endTime: data.endTime,
        },
      })
      .returning();

    revalidatePath("/admin/labs");
    revalidatePath("/faculty/labs");
    return { success: true, group: assigned };
  } catch (error) {
    console.error("Failed to assign exercise group:", error);
    return { success: false, error: "Permission denied or failed to assign time window" };
  }
}

export async function removeExerciseGroup(exerciseId: string, groupId: string) {
  try {
    const _perm = await checkEntityPermission({ entity: "labs", action: "update" });
    if (!_perm.allowed) return { success: false, error: _perm.reason ?? "Permission denied" };

    await db
      .delete(exerciseGroups)
      .where(
        and(
          eq(exerciseGroups.exerciseId, exerciseId),
          eq(exerciseGroups.groupId, groupId)
        )
      );

    revalidatePath("/admin/labs");
    revalidatePath("/faculty/labs");
    return { success: true };
  } catch (error) {
    console.error("Failed to remove exercise group:", error);
    return { success: false, error: "Permission denied or failed to remove time window" };
  }
}

// ─── Scheduling ───────────────────────────────────────────────────────────────

export async function scheduleExerciseForSemester(data: {
  exerciseId: string;
  startTime: Date;
  endTime: Date;
}) {
  try {
    const _perm = await checkEntityPermission({ entity: "labs", action: "update" });
    if (!_perm.allowed) return { success: false, error: _perm.reason ?? "Permission denied" };

    const exercise = await db.query.exercises.findFirst({
      where: eq(exercises.id, data.exerciseId),
      with: { lab: true },
    });

    if (!exercise) {
      return { success: false, error: "Exercise not found" };
    }

    const semester = String(exercise.lab.semester);

    const semesterUsers = await db.query.user.findMany({
      where: eq(user.semester, semester),
      columns: { id: true },
    });

    if (semesterUsers.length === 0) {
      return { success: false, error: "No students found for this semester" };
    }

    const userIds = semesterUsers.map((u) => u.id);

    const memberships = await db.query.userGroupMembers.findMany({
      where: inArray(userGroupMembers.userId, userIds),
      columns: { groupId: true },
    });

    const groupIds = [...new Set(memberships.map((m) => m.groupId))];

    if (groupIds.length === 0) {
      return {
        success: false,
        error: "No groups found for students in this semester",
      };
    }

    await Promise.all(
      groupIds.map((groupId) =>
        db
          .insert(exerciseGroups)
          .values({
            exerciseId: data.exerciseId,
            groupId,
            startTime: data.startTime,
            endTime: data.endTime,
          })
          .onConflictDoUpdate({
            target: [exerciseGroups.exerciseId, exerciseGroups.groupId],
            set: {
              startTime: data.startTime,
              endTime: data.endTime,
            },
          })
      )
    );

    revalidatePath("/admin/labs");
    revalidatePath("/faculty/labs");
    revalidatePath("/labs");

    return { success: true, groupsScheduled: groupIds.length };
  } catch (error) {
    console.error("Failed to schedule exercise for semester:", error);
    return { success: false, error: "Permission denied or failed to schedule exercise" };
  }
}

// ─── Student-facing ───────────────────────────────────────────────────────────

export async function getMyLab() {
  const session = await requireUser();

  const lab = await db.query.labs.findMany({
    where: eq(labs.semester, Number(session.user.semester)),
  });

  return lab ?? null;
}

export async function getMyExercises(labId: string) {
  const session = await requireUser();

  const allExercises = await db.query.exercises.findMany({
    where: eq(exercises.labId, labId),
    orderBy: (exercises, { asc }) => [asc(exercises.exerciseNo)],
    with: { groups: true },
  });

  const studentGroups = await db.query.userGroupMembers.findMany({
    where: eq(userGroupMembers.userId, session.user.id),
  });

  const groupIds = studentGroups.map((g) => g.groupId);
  const now = new Date();

  return allExercises.map((exercise) => {
    const relevantWindow = exercise.groups.find((g) =>
      groupIds.includes(g.groupId)
    );

    let status: "upcoming" | "active" | "ended" | "unscheduled" = "unscheduled";

    if (relevantWindow) {
      if (now < relevantWindow.startTime) status = "upcoming";
      else if (now > relevantWindow.endTime) status = "ended";
      else status = "active";
    }

    return {
      ...exercise,
      status,
      windowStart: relevantWindow?.startTime ?? null,
      windowEnd: relevantWindow?.endTime ?? null,
    };
  });
}

// ─── Lab Group Faculty Assignments ──────────────────────────────────────────

/**
 * Assign a faculty member to handle a specific lab for a specific group/section.
 * Replaces all existing assignments for that lab+group combination.
 */
export async function assignLabGroupFaculty({
  labId,
  groupId,
  facultyIds,
}: {
  labId: string;
  groupId: string;
  facultyIds: string[];
}) {
  try {
    const _perm = await checkEntityPermission({ entity: "labs", action: "update" });
    if (!_perm.allowed) return { success: false, error: _perm.reason ?? "Permission denied" };

    await db
      .delete(labGroupFaculty)
      .where(
        and(
          eq(labGroupFaculty.labId, labId),
          eq(labGroupFaculty.groupId, groupId)
        )
      );

    if (facultyIds.length > 0) {
      await db.insert(labGroupFaculty).values(
        facultyIds.map((facultyId) => ({ labId, groupId, facultyId }))
      );
    }

    revalidatePath("/admin/labs");
    revalidatePath("/faculty/labs");
    return { success: true };
  } catch (err) {
    console.error("[assignLabGroupFaculty]", err);
    return { success: false, error: "Failed to update faculty assignments" };
  }
}

/**
 * Get all faculty assignments for a lab, grouped by section.
 * Returns: { groupId, groupName, faculty: { id, name, email }[] }[]
 */
export async function getLabGroupFaculty(labId: string) {
  try {
    const session = await requireUser();

    // Faculty should only see their own assigned sections
    const isFaculty = session.user.role === "faculty";

    const rows = await db.query.labGroupFaculty.findMany({
      where: isFaculty
        ? and(eq(labGroupFaculty.labId, labId), eq(labGroupFaculty.facultyId, session.user.id))
        : eq(labGroupFaculty.labId, labId),
      with: {
        faculty: { columns: { id: true, name: true, email: true } },
        group: { columns: { id: true, name: true } },
      },
    });

    const byGroup = new Map<
      string,
      { groupId: string; groupName: string; faculty: { id: string; name: string | null; email: string }[] }
    >();
    for (const row of rows) {
      if (!byGroup.has(row.groupId)) {
        byGroup.set(row.groupId, { groupId: row.groupId, groupName: row.group.name, faculty: [] });
      }
      byGroup.get(row.groupId)!.faculty.push({
        id: row.faculty.id,
        name: row.faculty.name,
        email: row.faculty.email,
      });
    }
    return Array.from(byGroup.values());
  } catch (err) {
    console.error("[getLabGroupFaculty]", err);
    return [];
  }
}

/** Returns all users with role=faculty — used in the exercise form dialog faculty picker. */
export async function getFacultyUsers() {
  try {
    await requireUser();
    return await db.query.user.findMany({
      where: eq(user.role, "faculty"),
      columns: { id: true, name: true, email: true },
      orderBy: (u, { asc }) => [asc(u.name)],
    });
  } catch (err) {
    console.error("[getFacultyUsers]", err);
    return [];
  }
}

// ─── Submissions (used by admin + faculty) ────────────────────────────────────

export async function getExerciseSubmissions(
  exerciseId: string,
  filterGroupId?: string
) {
  try {
    const session = await requireUser();

    let allowedStudentIds: Set<string> | null = null;

    if (session.user.role === "faculty") {
      const ex = await db.query.exercises.findFirst({
        where: eq(exercises.id, exerciseId),
        columns: { labId: true },
      });
      if (!ex) return { success: false, error: "Exercise not found" };

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
            exercise: { id: exerciseId, exerciseNo: 0, title: "", programs: [] },
            students: [],
            message: "No student groups/sections are assigned to you for this lab.",
          },
        };
      }

      const targetGroupIds = filterGroupId && filterGroupId !== "all"
        ? (assignedGroupIds.includes(filterGroupId) ? [filterGroupId] : [])
        : assignedGroupIds;

      if (targetGroupIds.length === 0) {
        return { success: false, error: "Section not assigned to you for this lab" };
      }

      const members = await db.query.userGroupMembers.findMany({
        where: inArray(userGroupMembers.groupId, targetGroupIds),
      });
      allowedStudentIds = new Set(members.map((m) => m.userId));
    } else if (filterGroupId && filterGroupId !== "all") {
      const members = await db.query.userGroupMembers.findMany({
        where: eq(userGroupMembers.groupId, filterGroupId),
      });
      allowedStudentIds = new Set(members.map((m) => m.userId));
    }

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

    const programList = (exercise.collection?.questions ?? []).map(
      (cq, idx) => ({
        id: cq.questionId,
        programNo: idx + 1,
        title: cq.question.title,
      })
    );

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
                },
              },
            },
          })
        : [];

    if (allowedStudentIds) {
      submissions = submissions.filter((s) => allowedStudentIds!.has(s.userId));
    }

    let marks = await db.query.exerciseMarks.findMany({
      where: eq(exerciseMarks.exerciseId, exerciseId),
    });

    if (allowedStudentIds) {
      marks = marks.filter((m) => allowedStudentIds!.has(m.userId));
    }

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

    if (allowedStudentIds && allowedStudentIds.size > 0) {
      const studentUsers = await db.query.user.findMany({
        where: inArray(user.id, Array.from(allowedStudentIds)),
        columns: {
          id: true,
          name: true,
          email: true,
          username: true,
        },
      });

      for (const u of studentUsers) {
        studentMap.set(u.id, {
          id: u.id,
          name: u.name ?? "Unknown",
          email: u.email ?? "",
          username: u.username ?? null,
          solvedProgramIds: [],
          marks: null,
          implementationMarks: null,
          writeUpMarks: null,
          vivaMarks: null,
        });
      }
    }

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
    const session = await requireUser();
    const _perm = await checkEntityPermission({ entity: "labs", action: "update" });
    if (!_perm.allowed) return { success: false, error: _perm.reason ?? "Permission denied" };

    if (session.user.role === "faculty") {
      const windowCheck = await checkAwardMarksWindow(studentId, exerciseId);
      if (!windowCheck.allowed) {
        return { success: false, error: windowCheck.reason ?? "Grading period has expired" };
      }

      const ex = await db.query.exercises.findFirst({
        where: eq(exercises.id, exerciseId),
        columns: { labId: true },
      });
      if (!ex) return { success: false, error: "Exercise not found" };

      // Verify student belongs to a group this faculty is assigned to for this lab
      const assigned = await db.query.labGroupFaculty.findMany({
        where: and(
          eq(labGroupFaculty.labId, ex.labId),
          eq(labGroupFaculty.facultyId, session.user.id)
        ),
      });
      const assignedGroupIds = assigned.map((a) => a.groupId);
      if (assignedGroupIds.length > 0) {
        const studentMember = await db.query.userGroupMembers.findFirst({
          where: and(
            eq(userGroupMembers.userId, studentId),
            inArray(userGroupMembers.groupId, assignedGroupIds)
          ),
        });
        if (!studentMember) {
          return { success: false, error: "Student is not in your assigned section for this lab" };
        }
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
        marks: String(total), // keep legacy column updated with total
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
    return { success: false, error: "Permission denied or failed to award marks" };
  }
}