"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import { requireUser } from "@/lib/auth-access";
import { isStandardBranch, normalizeBranch, STANDARD_BRANCHES } from "@/lib/branch-utils";

export async function getStudentBranchStatus() {
  try {
    const session = await requireUser();

    const currentUser = await db.query.user.findFirst({
      where: eq(user.id, session.user.id),
      columns: { branch: true, role: true },
    });

    if (!currentUser) {
      return { success: false, error: "User not found" };
    }

    const rawBranch = currentUser.branch ?? null;
    const normalizedBranch = normalizeBranch(rawBranch);
    const isStandard = isStandardBranch(rawBranch);

    return {
      success: true,
      data: {
        userId: session.user.id,
        rawBranch,
        normalizedBranch,
        isStandard,
        needsConfirmation: !isStandard,
      },
    };
  } catch (error) {
    console.error("[getStudentBranchStatus] Error:", error);
    return { success: false, error: "Failed to get branch status" };
  }
}

export async function updateStudentBranch(selectedBranch: string) {
  try {
    const session = await requireUser();

    const normalized = normalizeBranch(selectedBranch);
    if (!STANDARD_BRANCHES.includes(normalized as any)) {
      return { success: false, error: "Invalid branch selected" };
    }

    const currentUser = await db.query.user.findFirst({
      where: eq(user.id, session.user.id),
      columns: { branch: true },
    });

    // If branch is different from DB, update DB profile
    if (currentUser?.branch !== normalized) {
      await db
        .update(user)
        .set({ branch: normalized, updatedAt: new Date() })
        .where(eq(user.id, session.user.id));
    }

    revalidatePath("/labs");
    revalidatePath("/dashboard");
    revalidatePath("/admin/users");
    revalidatePath("/admin");
    revalidatePath("/", "layout");

    return { success: true, branch: normalized };
  } catch (error) {
    console.error("[updateStudentBranch] Error:", error);
    return { success: false, error: "Failed to update branch" };
  }
}
