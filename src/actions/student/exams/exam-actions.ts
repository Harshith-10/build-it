"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  examAssignments,
  examAttendance,
  examCollections,
  examGroups,
  questions,
  type StrategyConfig,
  type StrategyConfigMap,
  userGroupMembers,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  generateShieldItChallenge,
  verifyShieldItSignature,
  type ShieldItSignaturePayload,
} from "@/lib/shieldit/shieldit-verifier";

export async function getShieldItExamChallenge(examId?: string): Promise<
  | { success: true; userId: string; nonce: string; timestamp: number }
  | { success: false; error: string }
> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const challenge = generateShieldItChallenge(session.user.id, examId);
  return {
    success: true,
    userId: session.user.id,
    ...challenge,
  };
}

export async function initializeExamSession(
  examId: string,
  pin?: string,
  shielditPayload?: ShieldItSignaturePayload | null,
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const userId = session.user.id;

  // 0. Optional / Configurable ShieldIt HMAC Handshake Verification
  if (process.env.REQUIRE_SHIELDIT_HMAC === "true" || shielditPayload) {
    if (!shielditPayload) {
      return {
        success: false,
        error:
          "ShieldIt Proctor Verification Required: Please ensure the official ShieldIt extension is active.",
      };
    }
    const verification = verifyShieldItSignature(
      userId,
      examId,
      shielditPayload,
    );
    if (!verification.valid) {
      return {
        success: false,
        error:
          verification.reason ||
          "ShieldIt security verification failed: Unofficial or tampered extension detected.",
      };
    }
  }

  try {
    // 1. Check for existing assignment (Idempotency)
    const existingAssignment = await db.query.examAssignments.findFirst({
      where: and(
        eq(examAssignments.userId, userId),
        eq(examAssignments.examId, examId),
      ),
    });

    if (existingAssignment) {
      // Block if exam was already submitted/completed
      if (existingAssignment.status === "completed") {
        return {
          success: false,
          error: "You have already submitted this exam. You cannot restart it.",
        };
      }

      return {
        success: true,
        assignmentId: existingAssignment.id,
        questionIds: existingAssignment.assignedQuestionIds,
      };
    }

    // 2. Access Control: Check Exam Group Slots
    const userMemberships = await db.query.userGroupMembers.findMany({
      where: eq(userGroupMembers.userId, userId),
    });
    const userGroupIds = userMemberships.map((m) => m.groupId);

    if (userGroupIds.length === 0) {
      throw new Error("Access Denied: You are not a member of any group.");
    }

    const relevantSlots = await db.query.examGroups.findMany({
      where: and(
        eq(examGroups.examId, examId),
        inArray(examGroups.groupId, userGroupIds),
      ),
      with: {
        exam: true,
      },
    });

    if (relevantSlots.length === 0) {
      throw new Error(
        "Access Denied: This exam is not assigned to your group.",
      );
    }

    const now = new Date();
    let hasValidSlot = false;
    let activeSlot = null;

    for (const slot of relevantSlots) {
      // If specific slot times are null, fallback to exam global times
      const startTime = slot.startTime ?? slot.exam.startTime;
      const endTime = slot.endTime ?? slot.exam.endTime;

      if (now >= startTime && now <= endTime) {
        hasValidSlot = true;
        activeSlot = slot;
        break;
      }
    }

    if (!hasValidSlot || !activeSlot) {
      throw new Error(
        "Access Denied: The exam is not currently active for your group slot.",
      );
    }

    // 3. Attendance Lockout Check
    if (activeSlot.exam.attendancePosted) {
      const attendance = await db.query.examAttendance.findFirst({
        where: and(
          eq(examAttendance.examId, examId),
          eq(examAttendance.userId, userId),
        ),
      });

      if (attendance && !attendance.present) {
        return {
          success: false,
          error: "Attendance Lockout: You have been marked absent for this exam. You cannot attempt this exam.",
        };
      }
    }

    // PIN Validation
    if (activeSlot.exam.requiresPin) {
      if (!pin) {
        return {
          success: false,
          error: "Exam PIN is required.",
        };
      }
      if (activeSlot.pin !== pin) {
        return {
          success: false,
          error: "Invalid Exam PIN. Please check with your proctor.",
        };
      }
    }

    // 3. Question Selection
    const examData = activeSlot.exam;
    const { strategyType } = examData;
    const { strategyConfig } = examData;

    const questionIds = await generateExamQuestions(
      examId,
      strategyType,
      strategyConfig,
    );

    if (questionIds.length < 3) {
      throw new Error(
        "System Error: Not enough questions in the bank to generate an exam.",
      );
    }

    // 4. Create Assignment
    const [newAssignment] = await db
      .insert(examAssignments)
      .values({
        userId,
        examId,
        assignedQuestionIds: questionIds,
        startedAt: new Date(),
        status: "in_progress",
      })
      .returning();

    return {
      success: true,
      assignmentId: newAssignment.id,
      questionIds: newAssignment.assignedQuestionIds,
    };
  } catch (error) {
    console.error("Exam Initialization Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to start exam",
    };
  }
}

export async function generateExamQuestions(
  examId: string,
  strategyType: keyof StrategyConfigMap,
  strategyConfig: StrategyConfig | null,
) {
  // Check if exam has specific collections assigned
  const linkedCollections = await db.query.examCollections.findMany({
    where: eq(examCollections.examId, examId),
    with: {
      collection: {
        with: {
          questions: true,
        },
      },
    },
  });

  let allowedQuestionIds: string[] = [];
  if (linkedCollections.length > 0) {
    // Use questions from collections
    const allowedIds = linkedCollections.flatMap((ec) =>
      ec.collection.questions.map((cq) => cq.questionId),
    );
    allowedQuestionIds = Array.from(new Set(allowedIds));

    if (allowedQuestionIds.length === 0) {
      throw new Error("Configuration Error: Assigned collections are empty.");
    }
  }

  let randomQuestions: { id: string }[] = [];

  if (strategyType === "fixed_set") {
    // Select ALL allowed questions
    const base = db.select({ id: questions.id }).from(questions);
    if (allowedQuestionIds.length > 0) {
      randomQuestions = await base.where(
        inArray(questions.id, allowedQuestionIds),
      );
    } else {
      randomQuestions = await base;
    }
  } else if (strategyType === "difficulty_mix" || strategyType === "lab_external") {
    const config = strategyConfig as StrategyConfigMap["difficulty_mix"] | null;
    const isLabExternal = strategyType === "lab_external";
    const easy = isLabExternal ? 2 : (config?.easy || 0);
    const medium = isLabExternal ? 2 : (config?.medium || 0);
    const hard = isLabExternal ? 1 : (config?.hard || 0);

    const fetchByDifficulty = async (
      diff: "easy" | "medium" | "hard",
      count: number,
    ) => {
      if (count <= 0) return [];
      const conditions: any[] = [eq(questions.difficulty, diff)];
      if (allowedQuestionIds.length > 0) {
        conditions.push(inArray(questions.id, allowedQuestionIds));
      }

      return db
        .select({ id: questions.id })
        .from(questions)
        .where(and(...conditions))
        .orderBy(sql`RANDOM()`)
        .limit(count);
    };

    const [easyQs, mediumQs, hardQs] = await Promise.all([
      fetchByDifficulty("easy", easy),
      fetchByDifficulty("medium", medium),
      fetchByDifficulty("hard", hard),
    ]);

    randomQuestions = [...easyQs, ...mediumQs, ...hardQs];
  } else {
    // "random_n" or default fallback
    const config = strategyConfig as StrategyConfigMap["random_n"] | null;
    const count = config?.count ?? 3;
    const conditions: any[] = [];
    if (allowedQuestionIds.length > 0) {
      conditions.push(inArray(questions.id, allowedQuestionIds));
    }

    const query = db
      .select({ id: questions.id })
      .from(questions)
      .orderBy(sql`RANDOM()`)
      .limit(count);

    if (conditions.length > 0) {
      randomQuestions = await query.where(and(...conditions));
    } else {
      randomQuestions = await query;
    }
  }

  return randomQuestions.map((q) => q.id);
}
