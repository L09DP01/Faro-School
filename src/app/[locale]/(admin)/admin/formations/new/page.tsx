import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { getAdminInstructorsList } from "@/lib/admin/instructors";
import { CourseFormClient } from "@/components/admin/courses";

interface AdminNewCoursePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: AdminNewCoursePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.courses.form" });

  return {
    title: `${t("createTitle")} | Faro School`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function AdminNewCoursePage({ params }: AdminNewCoursePageProps) {
  const { locale } = await params;
  const user = await requireStaff(locale);
  const instructors = user.role === "admin" ? await getAdminInstructorsList() : [];

  return (
    <CourseFormClient
      locale={locale}
      userRole={user.role}
      currentUserId={user.id}
      availableInstructors={instructors}
    />
  );
}
