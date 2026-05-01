import type { FacultyPermissions } from "@/db/schema/auth";

export const FACULTY_PERMISSION_ENTITIES = [
  "problems",
  "collections",
  "exams",
  "labs",
] as const;

export const FACULTY_PERMISSION_ACTIONS = [
  "create",
  "read",
  "update",
  "delete",
] as const;

export type FacultyPermissionEntity =
  (typeof FACULTY_PERMISSION_ENTITIES)[number];
export type FacultyPermissionAction =
  (typeof FACULTY_PERMISSION_ACTIONS)[number];

export const DEFAULT_FACULTY_PERMISSIONS: FacultyPermissions = {
  problems: { create: true, read: true, update: true, delete: false },
  collections: { create: true, read: true, update: true, delete: false },
  exams: { create: true, read: true, update: true, delete: false },
  labs: { create: true, read: true, update: true, delete: false },
};

export function normalizeFacultyPermissions(
  value: unknown,
): FacultyPermissions {
  if (!value || typeof value !== "object") {
    return DEFAULT_FACULTY_PERMISSIONS;
  }

  const source = value as Partial<Record<FacultyPermissionEntity, unknown>>;
  const normalized: FacultyPermissions = {
    problems: { ...DEFAULT_FACULTY_PERMISSIONS.problems },
    collections: { ...DEFAULT_FACULTY_PERMISSIONS.collections },
    exams: { ...DEFAULT_FACULTY_PERMISSIONS.exams },
    labs: { ...DEFAULT_FACULTY_PERMISSIONS.labs },
  };

  for (const entity of FACULTY_PERMISSION_ENTITIES) {
    const entityPermissions = source[entity];
    if (!entityPermissions || typeof entityPermissions !== "object") {
      continue;
    }

    const typedEntityPermissions = entityPermissions as Partial<
      Record<FacultyPermissionAction, boolean>
    >;

    for (const action of FACULTY_PERMISSION_ACTIONS) {
      if (typeof typedEntityPermissions[action] === "boolean") {
        normalized[entity][action] = typedEntityPermissions[action] as boolean;
      }
    }
  }

  return normalized;
}

export function canFaculty(
  permissions: FacultyPermissions,
  entity: FacultyPermissionEntity,
  action: FacultyPermissionAction,
) {
  return permissions[entity][action];
}
