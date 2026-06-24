'use server'

import { db } from "@/db"; // Adjust if your db import is different
import { code365Problems } from "@/db/schema/code365";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { notInArray, desc, sql } from "drizzle-orm";
import { questions } from "@/db/schema/questions";

export async function assignDailyProblem(formData: FormData) {
  try {
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const difficulty = formData.get('difficulty') as string;
    const estimatedMinutes = parseInt(formData.get('estimatedMinutes') as string);
    const dateAssigned = formData.get('dateAssigned') as string; // Format: YYYY-MM-DD
    const tagsString = formData.get('tags') as string;
    
    // Convert comma-separated string to an array and trim spaces
    const tags = tagsString.split(',').map(tag => tag.trim()).filter(Boolean);

    // Insert into database
    await db.insert(code365Problems).values({
      title,
      description,
      difficulty,
      estimatedMinutes,
      dateAssigned,
      tags,
    });

    // Refresh both the admin and student pages so the new problem shows up instantly
    revalidatePath('/admin/code365');
    revalidatePath('/code365');

    return { success: true };
  } catch (error: any) {
    // If there is a unique constraint error (e.g., already assigned a problem for this date)
    if (error.code === '23505') {
      return { success: false, message: "A problem is already assigned for this date!" };
    }
    return { success: false, message: "Failed to assign problem." };
  }
}

export async function autoPickDailyProblem(dateString: string) {
  try {
    // 1. Get titles of problems assigned in the last 60 days to prevent repetition
    const recentAssignments = await db
      .select({ title: code365Problems.title })
      .from(code365Problems)
      .orderBy(desc(code365Problems.dateAssigned))
      .limit(60);

    const recentTitles = recentAssignments.map(a => a.title);

    // 2. Query the questions bank for a random problem NOT in the recent list
    let query = db.select().from(questions);
    
    if (recentTitles.length > 0) {
      query = query.where(notInArray(questions.title, recentTitles)) as typeof query;
    }

    const availableProblems = await query.orderBy(sql`RANDOM()`).limit(1);

    let selectedProblem = availableProblems[0];

    // Failsafe: if all questions were recently used, pick any random one
    if (!selectedProblem) {
      const fallbackResults = await db
        .select()
        .from(questions)
        .orderBy(sql`RANDOM()`)
        .limit(1);
      
      selectedProblem = fallbackResults[0];
    }

    // If there are literally no questions in the bank, return null
    if (!selectedProblem) {
      console.warn("autoPickDailyProblem: No questions found in the questions table.");
      return null;
    }

    // 3. Insert the newly picked problem into the Code365 daily table
    const [newDailyProblem] = await db.insert(code365Problems).values({
      originalQuestionId: selectedProblem.id,
      title: selectedProblem.title,
      description: selectedProblem.problemStatement,
      difficulty: selectedProblem.difficulty || 'medium',
      estimatedMinutes: 30,
      tags: [],
      dateAssigned: dateString,
    }).returning();

    revalidatePath('/code365');
    return newDailyProblem;
  } catch (error) {
    console.error("autoPickDailyProblem failed:", error);
    return null;
  }
}