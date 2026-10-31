import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/permissions";
import {
  getStaffConversations,
  getConversationById,
  getConversationMessages,
} from "@/lib/messaging/data";
import { StudentStaffChatView } from "@/components/messaging/StudentStaffChatView";
import { StaffAvailabilityToggle } from "@/components/messaging/StaffAvailabilityToggle";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Échange Étudiant | Espace Formateur",
  robots: { index: false, follow: false },
};

interface AdminConversationPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function AdminConversationPage({
  params,
}: AdminConversationPageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const user = await requireRole(["admin", "instructor"], locale, `/${locale}/admin/messages/${id}`);

  const [conversations, activeConversation, initialMessages] = await Promise.all([
    getStaffConversations(user.id, false, user.role === "admin"),
    getConversationById(id, user.id, user.role),
    getConversationMessages(id),
  ]);

  if (!activeConversation || activeConversation.staffId !== user.id && !(user.role === "admin" && !activeConversation.courseId)) {
    notFound();
  }

  return (
    <div className="w-full h-full p-2 md:p-4 space-y-4">
      <div className="flex items-center justify-between px-2">
        <h1 className="text-xl font-heading font-bold text-ink">
          Messagerie Privée & Support Formateur
        </h1>
        <StaffAvailabilityToggle initialAvailable={true} locale={locale} />
      </div>

      <StudentStaffChatView
        conversations={conversations}
        activeConversation={activeConversation}
        initialMessages={initialMessages}
        currentUserId={user.id}
        currentUserRole={user.role}
        currentUserName={user.fullName || "Formateur"}
        enrolledCourses={[]}
        locale={locale}
      />
    </div>
  );
}
