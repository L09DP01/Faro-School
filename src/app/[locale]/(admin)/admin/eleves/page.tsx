import {AdminDataUnavailable} from "@/components/admin/AdminDataUnavailable";
import { requireStaff } from "@/lib/auth";
import { getAdminStudentsList, getAllAvailableCourses } from "@/lib/admin/students";
import { AdminStudentsClient } from "@/components/admin/students/AdminStudentsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gestion des Élèves | Faro School Admin",
  robots: { index: false, follow: false },
};

interface AdminElevesPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminElevesPage({ params }: AdminElevesPageProps) {
  const { locale } = await params;
  const user = await requireStaff(locale);
  const instructorId = user.role === "instructor" ? user.id : undefined;

  try {
  const [students, courses] = await Promise.all([
    getAdminStudentsList(instructorId),
    getAllAvailableCourses(instructorId),
  ]);

  return (
    <AdminStudentsClient
      initialStudents={students}
      availableCourses={courses}
      isInstructor={user.role === "instructor"}
      locale={locale}
    />
  );
  } catch {return <AdminDataUnavailable locale={locale}/>;}
}
