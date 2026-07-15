import { NextResponse } from "next/server";
import { autoPickDailyProblem } from "@/actions/admin/code365-actions";
import { getTodayIST } from "@/lib/date-utils";

/**
 * GET /api/cron/code365
 *
 * This endpoint ensures a daily Code365 problem exists for today (IST).
 * It can be triggered by:
 *   - An external cron service (e.g., Vercel Cron, GitHub Actions, crontab)
 *   - The client-side midnight rotation hook in the student dashboard
 *
 * It is idempotent — calling it multiple times for the same day is safe
 * because autoPickDailyProblem inserts with a UNIQUE date constraint.
 */
export async function GET() {
  try {
    const todayIST = getTodayIST();
    const problem = await autoPickDailyProblem(todayIST);

    if (problem) {
      return NextResponse.json({
        success: true,
        message: `Daily problem assigned for ${todayIST}`,
        problemId: problem.id,
        title: problem.title,
      });
    }

    return NextResponse.json({
      success: false,
      message:
        "Could not assign a daily problem. The questions bank may be empty, or a problem already exists for today.",
    });
  } catch (error: any) {
    // Unique constraint violation = problem already assigned for today
    if (error?.code === "23505") {
      return NextResponse.json({
        success: true,
        message: "A problem is already assigned for today.",
      });
    }

    console.error("Cron code365 error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
