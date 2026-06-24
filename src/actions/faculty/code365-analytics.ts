'use server';

import { db } from "@/db";
import { code365Problems, code365Submissions, code365UserStats } from "@/db/schema/code365";
import { count, desc, eq, sql } from "drizzle-orm";

export async function getCode365Analytics() {
  try {
    // 1. Total Submissions
    const [{ value: totalSubmissions }] = await db
      .select({ value: count() })
      .from(code365Submissions);

    // 2. Today's Problem & Solves
    const today = new Date().toISOString().split('T')[0];
    let todaysProblemTitle = "No problem assigned today";
    let todaySolves = 0;

    const todaysProblem = await db.query.code365Problems.findFirst({
      where: eq(code365Problems.dateAssigned, today),
    });

    if (todaysProblem) {
      todaysProblemTitle = todaysProblem.title;
      const [{ value: solvesCount }] = await db
        .select({ value: count() })
        .from(code365Submissions)
        .where(eq(code365Submissions.problemId, todaysProblem.id));
      
      todaySolves = solvesCount;
    }

    // 3. Active Streaks (highest first)
    const activeStreaks = await db
      .select({ currentStreak: code365UserStats.currentStreak })
      .from(code365UserStats)
      .where(sql`${code365UserStats.currentStreak} > 0`)
      .orderBy(desc(code365UserStats.currentStreak))
      .limit(10); // top 10

    // 4. Recent Submissions
    const recentSubmissions = await db
      .select({
        userId: code365Submissions.userId,
        problemId: code365Submissions.problemId,
      })
      .from(code365Submissions)
      .orderBy(desc(code365Submissions.solvedAt))
      .limit(10);

    return {
      success: true,
      data: {
        totalSubmissions,
        todaySolves,
        todaysProblemTitle,
        activeStreaks,
        recentSubmissions,
      },
    };
  } catch (error) {
    console.error("Error fetching Code365 analytics:", error);
    return { success: false };
  }
}
