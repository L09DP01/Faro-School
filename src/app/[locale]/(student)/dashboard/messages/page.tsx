import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-user";
import { setRequestLocale } from "next-intl/server";
import {
  getStudentConversations,
  getStudentEnrolledCourses,
  getStudentSystemNotifications,
} from "@/lib/messaging/data";
import { StudentStaffChatView } from "@/components/messaging/StudentStaffChatView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Messages | Faro School",
  description: "Tickets, messages système et échanges avec vos professeurs et la direction.",
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

  const [conversations, enrolledCourses, systemNotifications] = await Promise.all([
    getStudentConversations(user.id),
    getStudentEnrolledCourses(user.id),
    getStudentSystemNotifications(user.id),
  ]);

  const activeConversation = null;
  const initialMessages:never[]=[];

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
