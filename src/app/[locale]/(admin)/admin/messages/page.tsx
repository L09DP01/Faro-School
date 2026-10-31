import { requireStaff } from "@/lib/auth";
import { getAdminMessagesList } from "@/lib/admin/messages";
import { AdminMessagesClient } from "@/components/admin/messages/AdminMessagesClient";
import { InstructorMessagesClient } from "@/components/admin/messages/InstructorMessagesClient";
import { getStaffConversations } from "@/lib/messaging/data";
import { getAdminStudentsList, getAllAvailableCourses } from "@/lib/admin/students";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Boîte de réception & Échanges | Faro School Admin",
  robots: { index: false, follow: false },
};

interface AdminMessagesPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    new?: string;
    studentId?: string;
    convId?: string;
    tab?: string;
  }>;
}

export default async function AdminMessagesPage({
  params,
  searchParams,
}: AdminMessagesPageProps) {
  const { locale } = await params;
  const { new: newParam, studentId, convId, tab } = await searchParams;
  const user = await requireStaff(locale);

  // If instructor: strictly pedagogical conversations for their courses
  if (user.role === "instructor") {
    const [conversations, enrolledStudents, instructorCourses] = await Promise.all([
      getStaffConversations(user.id, false, false),
      getAdminStudentsList(user.id),
      getAllAvailableCourses(user.id),
    ]);

    return (
      <InstructorMessagesClient
        initialConversations={conversations}
        initialActiveId={convId || null}
        initialNewStudentId={studentId || null}
        enrolledStudents={enrolledStudents}
        instructorCourses={instructorCourses}
        currentUserId={user.id}
        currentUserName={user.fullName || "Formateur"}
        currentUserRole="instructor"
        locale={locale}
      />
    );
  }

  // Admin view: allow switching between Contact messages and Pedagogical conversations
  const currentTab = tab || "pedagogical";

  if (currentTab === "contact") {
    const messages = await getAdminMessagesList();
    return (
      <div className="space-y-4">
        {/* Admin Tab Switcher */}
        <div className="flex gap-2 border-b border-line pb-2">
          <a
            href={`/${locale}/admin/messages?tab=pedagogical`}
            className="px-4 py-2 text-xs font-heading font-semibold rounded-xl border border-line text-muted-faro hover:text-ink hover:bg-surface transition-colors"
          >
            {locale === "ht" ? "Sipò teknik ak kou mwen yo" : "Support technique et mes cours"}
          </a>
          <a
            href={`/${locale}/admin/messages?tab=contact`}
            className="px-4 py-2 text-xs font-heading font-semibold rounded-xl bg-ink text-surface transition-colors"
          >
            {locale === "ht" ? "Fòm kontak piblik" : "Formulaire de contact public"}
          </a>
        </div>
        <AdminMessagesClient initialMessages={messages} locale={locale} />
      </div>
    );
  }

  const [conversations, enrolledStudents, courses] = await Promise.all([
    getStaffConversations(user.id, false, user.role === "admin"),
    getAdminStudentsList(),
    getAllAvailableCourses(user.id),
  ]);

  return (
    <div className="space-y-4">
      {/* Admin Tab Switcher */}
      <div className="flex gap-2 border-b border-line pb-2">
        <a
          href={`/${locale}/admin/messages?tab=pedagogical`}
          className="px-4 py-2 text-xs font-heading font-semibold rounded-xl bg-ink text-surface transition-colors"
        >
          Échanges Formateurs & Élèves
        </a>
        <a
          href={`/${locale}/admin/messages?tab=contact`}
          className="px-4 py-2 text-xs font-heading font-semibold rounded-xl border border-line text-muted-faro hover:text-ink hover:bg-surface transition-colors"
        >
          Formulaire de Contact Public
        </a>
      </div>
      <InstructorMessagesClient
        initialConversations={conversations}
        initialActiveId={convId || null}
        initialNewStudentId={studentId || null}
        enrolledStudents={enrolledStudents}
        instructorCourses={courses}
        currentUserId={user.id}
        currentUserName={user.fullName || "Admin"}
        currentUserRole="admin"
        locale={locale}
      />
    </div>
  );
}
