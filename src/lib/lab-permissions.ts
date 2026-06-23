import type { FacultyPermissions } from "@/db/schema/auth";

type User = {
  role?: string | null;
  facultyPermissions?: FacultyPermissions | null;
};

// ── Role checks ───────────────────────────────────────────

export function isAdmin(user: User) {
  return user.role === "admin";
}

export function isFaculty(user: User) {
  return user.role === "faculty";
}

export function isStudent(user: User) {
  return user.role === "student";
}

// ── Lab-specific permission checks ───────────────────────

// Only admin can create or delete entire labs
export function canManageLabs(user: User) {
  return isAdmin(user);
}

// Admin always has full access
// Faculty needs labs.create = true in their permissions
export function canManageExercises(user: User) {
  if (isAdmin(user)) return true;
  if (isFaculty(user)) return user.facultyPermissions?.labs?.create ?? false;
  return false;
}

// Admin or faculty with read access can view submissions
export function canViewSubmissions(user: User) {
  if (isAdmin(user)) return true;
  if (isFaculty(user)) return user.facultyPermissions?.labs?.read ?? false;
  return false;
}

// Admin or faculty with update access can award/edit marks
export function canEditMarks(user: User) {
  if (isAdmin(user)) return true;
  if (isFaculty(user)) return user.facultyPermissions?.labs?.update ?? false;
  return false;
}
