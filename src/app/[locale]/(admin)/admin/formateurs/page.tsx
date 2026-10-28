import { requireAdmin } from "@/lib/auth";
import { getAdminInstructorsList } from "@/lib/admin/instructors";
import { getAllAvailableCourses } from "@/lib/admin/students";
import { AdminInstructorsClient } from "@/components/admin/instructors/AdminInstructorsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gestion des Formateurs | Limyè Akademi Admin",
  robots: { index: false, follow: false },
};

interface AdminFormateursPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminFormateursPage({
  params,
}: AdminFormateursPageProps) {
  const { locale } = await params;
  await requireAdmin(locale);

  const [instructors, availableCourses] = await Promise.all([
    getAdminInstructorsList(),
    getAllAvailableCourses(),
  ]);

  return (
    <AdminInstructorsClient
      initialInstructors={instructors}
      availableCourses={availableCourses}
      locale={locale}
    />
  );
}
