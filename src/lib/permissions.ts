import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/get-user";

export type Role = "student" | "instructor" | "admin";

export type PermissionAction =
  | "community.access"
  | "course.manage"
  | "course.publish"
  | "course.change_instructor"
  | "students.view"
  | "admin.dashboard"
  | "instructor.dashboard"
  | "payments.view"
  | "promotions.manage"
  | "instructors.manage"
  | "community.moderate"
  | "community.pin"
  | "ai.configure"
  | "emails.manage"
  | "certificates.read"
  | "certificates.manage";

export interface PermissionUser {
  id: string;
  role: Role;
  [key: string]: any;
}

export interface CourseResource {
  instructor_id?: string | null;
  [key: string]: any;
}

export interface StudentResource {
  enrolledCourseInstructorIds?: string[];
  [key: string]: any;
}

export type PermissionResource =
  | CourseResource
  | StudentResource
  | Record<string, any>;

/**
 * Central permission check function.
 * Evaluates whether a user is allowed to perform an action on an optional resource.
 */
export function can(
  user: PermissionUser | null | undefined,
  action: PermissionAction,
  resource?: PermissionResource
): boolean {
  if (!user) return false;

  // Admin has omnipotent permissions across all actions
  if (user.role === "admin") {
    return true;
  }

  // Student permissions (standard student role has no elevated admin/instructor actions)
  if (user.role === "student") {
    if(action === "community.access")return resource?.hasActiveEnrollment === true;
    return false;
  }

  // Instructor permissions
  if (user.role === "instructor") {
    switch (action) {
      case "community.access":
        return true;
      case "certificates.read":
        return Boolean(resource && resource.instructor_id === user.id);
      case "certificates.manage":
        return false;
      case "course.manage":
      case "course.publish":
        // If a specific course resource is supplied, check instructor ownership
        if (resource && "instructor_id" in resource && resource.instructor_id !== undefined) {
          return resource.instructor_id === user.id;
        }
        // General access to create or list own courses
        return true;

      case "course.change_instructor":
        // Only admin can assign or reassign course instructors
        return false;

      case "students.view":
        // If student's enrolled courses instructors are provided, user must be one of them
        if (resource && "enrolledCourseInstructorIds" in resource && Array.isArray(resource.enrolledCourseInstructorIds)) {
          return resource.enrolledCourseInstructorIds.includes(user.id);
        }
        // Allowed to view student section for own students
        return true;

      case "admin.dashboard":
        // Instructor cannot access platform-level KPI dashboard
        return false;

      case "instructor.dashboard":
        // Allowed to access instructor personal workspace/stats
        return true;

      case "payments.view":
      case "promotions.manage":
      case "instructors.manage":
      case "ai.configure":
      case "community.moderate":
        // Strictly admin only
        return false;

      case "community.pin":
        // Instructors can pin community posts
        return true;

      default:
        return false;
    }
  }

  return false;
}

/**
 * Asserts permission and throws a forbidden error if unauthorized.
 */
export function requirePermission(
  user: PermissionUser | null | undefined,
  action: PermissionAction,
  resource?: PermissionResource
): void {
  if (!can(user, action, resource)) {
    throw new Error(
      `403 Forbidden: User ${user?.id || "anonymous"} does not have permission '${action}'.`
    );
  }
}

/**
 * Route / Server Action guard ensuring user has one of the allowed roles.
 */
export async function requireRole(
  allowedRoles: Role | Role[],
  currentLocale: string = "fr",
  redirectPath?: string
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (!user) {
    const target = redirectPath || `/${currentLocale}/admin`;
    redirect(`/${currentLocale}/connexion?redirectTo=${encodeURIComponent(target)}`);
  }

  if (!roles.includes(user.role)) {
    if (user.role === "instructor") {
      redirect(`/${currentLocale}/admin/unauthorized`);
    }
    redirect(`/${currentLocale}/dashboard`);
  }

  return user;
}
