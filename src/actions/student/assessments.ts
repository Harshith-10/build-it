"use server";

import { and, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  examAssignments,
  examGroups,
  exams,
  userGroupMembers,
} from "@/db/schema";
import { auth } from "@/lib/auth";

export async function getStudentAssessments() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const userId = session.user.id;

  const memberships = await db.query.userGroupMembers.findMany({
    where: eq(userGroupMembers.userId, userId),
  });
  const userGroupIds = memberships.map((membership) => membership.groupId);

  if (userGroupIds.length === 0) {
    return [];
  }

  const allAssessments = await db.query.exams.findMany({
    where: inArray(exams.assessmentType, [
      "lab_assessment",
      "coding_assessment",
    ]),
    orderBy: (exams, { asc }) => [asc(exams.startTime)],
    with: {
      lab: {
        columns: {
          id: true,
          name: true,
          code: true,
        },
      },
      collections: {
        with: {
          collection: {
            columns: {
              id: true,
              title: true,
            },
          },
        },
      },
      groups: {
        where: inArray(examGroups.groupId, userGroupIds),
        with: {
          group: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  const userAssignments = await db.query.examAssignments.findMany({
    where: eq(examAssignments.userId, userId),
    columns: {
      examId: true,
      status: true,
      score: true,
      startedAt: true,
      completedAt: true,
    },
  });

  const assignmentMap = new Map(
    userAssignments.map((assignment) => [assignment.examId, assignment]),
  );

  const now = new Date();

  return allAssessments
    .filter((assessment) => assessment.groups.length > 0)
    .map((assessment) => {
      // Find active slot or first assigned slot for the student's group
      let effectiveStart = assessment.startTime;
      let effectiveEnd = assessment.endTime;
      let hasPin = assessment.requiresPin;
      let slotGroupName = "";

      if (assessment.groups.length > 0) {
        const activeSlot = assessment.groups.find((g) => {
          const start = g.startTime ?? assessment.startTime;
          const end = g.endTime ?? assessment.endTime;
          return now >= start && now <= end;
        });

        const targetSlot = activeSlot || assessment.groups[0];
        if (targetSlot) {
          if (targetSlot.startTime) effectiveStart = targetSlot.startTime;
          if (targetSlot.endTime) effectiveEnd = targetSlot.endTime;
          if (targetSlot.pin) hasPin = true;
          slotGroupName = targetSlot.group.name;
        }
      }

      let status: "upcoming" | "active" | "ended" = "upcoming";
      if (now < effectiveStart) status = "upcoming";
      else if (now <= effectiveEnd) status = "active";
      else status = "ended";

      const assignment = assignmentMap.get(assessment.id);

      const totalMarks =
        (assessment.gradingConfig as any)?.totalMarks ?? 100;

      const questionCount =
        (assessment.strategyConfig as any)?.count ??
        (Array.isArray((assessment.strategyConfig as any)?.exerciseIds)
          ? (assessment.strategyConfig as any).exerciseIds.length
          : null);

      return {
        id: assessment.id,
        title: assessment.title,
        description: assessment.description,
        assessmentType: assessment.assessmentType as
          | "lab_assessment"
          | "coding_assessment",
        lab: assessment.lab,
        durationMinutes: assessment.durationMinutes,
        totalMarks,
        questionCount,
        requiresPin: hasPin,
        startTime: effectiveStart,
        endTime: effectiveEnd,
        status,
        slotGroupName,
        attemptStatus: assignment?.status || "not_started",
        score: assignment?.score ?? null,
      };
    });
}
