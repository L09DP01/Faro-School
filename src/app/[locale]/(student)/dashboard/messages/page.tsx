import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-user";
import { setRequestLocale } from "next-intl/server";
import {
  getStudentConversations,
  getStudentEnrolledCourses,
  getConversationMessages,
} from "@/lib/messaging/data";
import { StudentStaffChatView } from "@/components/messaging/StudentStaffChatView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Messages du formateur | Faro School",
  description: "Échangez directement avec vos formateurs et suivez vos questions pédagogiques.",
};

interface StudentMessagesPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ new?: string; courseId?: string }>;
}

export default async function StudentMessagesPage({
  params,
  searchParams,
}: StudentMessagesPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/connexion?next=/${locale}/dashboard/messages`);
  }

  const [conversations, enrolledCourses] = await Promise.all([
    getStudentConversations(user.id),
    getStudentEnrolledCourses(user.id),
  ]);

  const activeConversation = conversations[0] || null;
  const initialMessages = activeConversation
    ? await getConversationMessages(activeConversation.id)
    : [];

  return (
    <div className="w-full h-full p-2 md:p-4">
      <StudentStaffChatView
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
