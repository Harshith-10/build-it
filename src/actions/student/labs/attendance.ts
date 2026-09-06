"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { exercises, exerciseAttendance } from "@/db/schema/labs";
import { requireUser } from "@/lib/auth-access";

/**
 * Called by the student IDE shell every 30 seconds.
 * Returns whether the student is locked out of this exercise due to attendance.
 */
export async function checkAttendanceStatus(
  exerciseId: string
): Promise<{ locked: boolean }> {
  try {
    const session = await requireUser();

    const record = await db.query.exerciseAttendance.findFirst({
      where: and(
        eq(exerciseAttendance.exerciseId, exerciseId),
        eq(exerciseAttendance.userId, session.user.id),
      ),
      columns: { present: true },
    });

    // If student has an explicit attendance record marked absent, lock out immediately
    if (record && !record.present) {
      return { locked: true };
    }
    return { locked: false };
  } catch {
    return { locked: false };
  }
}
