import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "./get-user";

/**
 * Ensures the user is logged in and has an 'admin' role.
 * If user is an instructor, redirects to /admin/unauthorized (403).
 * Redirects to /connexion or /dashboard otherwise.
 */
export async function requireAdmin(
  currentLocale: string = "fr"
): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${currentLocale}/connexion?next=/${currentLocale}/admin`);
  }

  if (user.role === "instructor") {
    redirect(`/${currentLocale}/admin/unauthorized`);
  }

  if (user.role !== "admin") {
    redirect(`/${currentLocale}/dashboard`);
  }

  return user;
}

/**
 * Ensures the user is logged in and is either an admin or an instructor.
 * Redirects to /connexion or /dashboard otherwise.
 */
export async function requireInstructor(
  currentLocale: string = "fr",
  redirectTo: string = "/admin/formations"
): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${currentLocale}/connexion?next=/${currentLocale}${redirectTo}`);
  }

  if (user.role !== "instructor" && user.role !== "admin") {
    redirect(`/${currentLocale}/admin/unauthorized`);
  }

  return user;
}

/**
 * Ensures the user is logged in and is either an admin or an instructor.
 * Redirects to /connexion or /dashboard otherwise.
 */
export async function requireStaff(
  currentLocale: string = "fr",
  redirectTo: string = "/admin"
): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${currentLocale}/connexion?next=/${currentLocale}${redirectTo}`);
  }

  if (user.role !== "admin" && user.role !== "instructor") {
    redirect(`/${currentLocale}/dashboard`);
  }

  return user;
}

/**
 * Ensures the user is logged in. Redirects to /connexion otherwise.
 */
export async function requireUser(
  currentLocale: string = "fr",
  redirectTo?: string
): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    const query = redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : "";
    redirect(`/${currentLocale}/connexion${query}`);
  }

  return user;
}
