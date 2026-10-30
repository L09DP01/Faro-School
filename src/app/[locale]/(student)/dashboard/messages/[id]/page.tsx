import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-user";
import { setRequestLocale } from "next-intl/server";
import {
  getStudentConversations,
  getStudentSystemNotifications,
  getConversationById,
  getConversationMessages,
  getStudentEnrolledCourses,
} from "@/lib/messaging/data";
import { StudentStaffChatView } from "@/components/messaging/StudentStaffChatView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Discussion privée | Faro School",
};

interface StudentConversationPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function StudentConversationPage({
  params,
}: StudentConversationPageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/connexion?next=/${locale}/dashboard/messages/${id}`);
  }

  const [conversations, activeConversation, initialMessages, enrolledCourses, systemNotifications] =
    await Promise.all([
      getStudentConversations(user.id),
      getConversationById(id, user.id, user.role),
      getConversationMessages(id),
      getStudentEnrolledCourses(user.id),
      getStudentSystemNotifications(user.id),
    ]);

  if (!activeConversation) {
    notFound();
  }

  return (
    <div className="w-full h-full p-2 md:p-4">
      <StudentStaffChatView
        systemNotifications={systemNotifications}
        conversations={conversations}
        activeConversation={activeConversation}
        initialMessages={initialMessages}
        currentUserId={user.id}
        currentUserRole={user.role}
        currentUserName={user.fullName || "Étudiant"}
        enrolledCourses={enrolledCourses}
        locale={locale}
      />
    </div>
  );
}
