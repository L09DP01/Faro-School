import { setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/permissions";
import {
  getCommunityMessages,
  getPinnedMessage,
  getCommunityGroupInfo,
  getCommunityMembers,
  hasAcceptedCommunityRules,
} from "@/lib/community/data";
import { CommunityChatView } from "@/components/community/CommunityChatView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Communauté — Administration Faro School",
  robots: {
    index: false,
    follow: false,
  },
};

interface AdminCommunityPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminCommunityPage({ params }: AdminCommunityPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Both admin and instructor have access to this screen inside the admin workspace
  const user = await requireRole(["admin", "instructor"], locale, `/${locale}/admin/communaute`);

  const [
    messagesResult,
    pinnedMessage,
    groupInfo,
    members,
    hasAcceptedRules,
  ] = await Promise.all([
    getCommunityMessages(user.id, 50),
    getPinnedMessage(),
    getCommunityGroupInfo(user.id),
    getCommunityMembers(),
    hasAcceptedCommunityRules(user.id),
  ]);

  return (
    <div className="w-full h-full p-2 md:p-4">
      <CommunityChatView
        initialMessages={messagesResult.messages}
        initialPinnedMessage={pinnedMessage}
        groupInfo={groupInfo}
        members={members}
        currentUser={{
          id: user.id,
          fullName: user.fullName || "Admin / Formateur",
          email: user.email,
          role: user.role,
        }}
        hasAcceptedRules={hasAcceptedRules}
        locale={locale}
      />
    </div>
  );
}
