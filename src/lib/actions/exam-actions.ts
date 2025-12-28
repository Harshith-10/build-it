"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  examAssignments,
  examGroups,
  questions,
  userGroupMembers,
} from "@/db/schema";
import { auth } from "@/lib/auth";

export async function initializeExamSession(examId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const userId = session.user.id;

  try {
    // 1. Check for existing assignment (Idempotency)
    const existingAssignment = await db.query.examAssignments.findFirst({
      where: and(
        eq(examAssignments.userId, userId),
        eq(examAssignments.examId, examId),
      ),
    });

    if (existingAssignment) {
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

    for (const slot of relevantSlots) {
      // If specific slot times are null, fallback to exam global times
      const startTime = slot.startTime ?? slot.exam.startTime;
      const endTime = slot.endTime ?? slot.exam.endTime;

      if (now >= startTime && now <= endTime) {
        hasValidSlot = true;
        break;
      }
    }

    // Check if the exam itself is "active" or "ongoing" in status?
    // Usually status is derived or manually set. If manual "upcoming", maybe block?
    // For now, rely on Time.

    if (!hasValidSlot) {
      throw new Error(
        "Access Denied: The exam is not currently active for your group slot.",
      );
    }

    // 3. Randomization
    const randomQuestions = await db
      .select({ id: questions.id })
      .from(questions)
      .orderBy(sql`RANDOM()`)
      .limit(3);

    if (randomQuestions.length < 3) {
      throw new Error(
        "System Error: Not enough questions in the bank to generate an exam.",
      );
    }

    const questionIds = randomQuestions.map((q) => q.id);

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
