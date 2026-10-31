import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { getAdminCourseById } from "@/lib/admin/courses";
import { getAdminInstructorsList } from "@/lib/admin/instructors";
import { CourseFormClient } from "@/components/admin/courses";

interface AdminEditCoursePageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({
  params,
}: AdminEditCoursePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.courses.form" });

  return {
    title: `${t("editTitle")} | Faro School`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function AdminEditCoursePage({
  params,
}: AdminEditCoursePageProps) {
  const { locale, id } = await params;
  const user = await requireStaff(locale);

  const [course, instructors] = await Promise.all([
    getAdminCourseById(id),
    user.role === "admin" ? getAdminInstructorsList() : Promise.resolve([]),
  ]);

  if (!course) {
    notFound();
  }

  // Instructor isolation: cannot edit another instructor's course
  if (user.role === "instructor" && course.instructorId && course.instructorId !== user.id) {
    redirect(`/${locale}/admin/unauthorized`);
  }

  return (
    <CourseFormClient
      initialCourse={course}
      locale={locale}
      userRole={user.role}
      currentUserId={user.id}
      availableInstructors={instructors.filter(i=>i.isActive)}
    />
  );
}
