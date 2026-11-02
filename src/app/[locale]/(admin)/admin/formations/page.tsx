import {AdminDataUnavailable} from "@/components/admin/AdminDataUnavailable";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { getAdminCoursesList } from "@/lib/admin/courses";
import { CourseListClient } from "@/components/admin/courses";

interface AdminCoursesPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: AdminCoursesPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.courses" });

  return {
    title: `${t("listTitle")} | Faro School`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function AdminCoursesPage({ params }: AdminCoursesPageProps) {
  const { locale } = await params;
  const user = await requireStaff(locale);
  const instructorId = user.role === "instructor" ? user.id : undefined;

  try {
  const courses = await getAdminCoursesList(instructorId);

  return <CourseListClient courses={courses} locale={locale} />;
  } catch {return <AdminDataUnavailable locale={locale}/>;}
}
