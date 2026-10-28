import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-user";
import { setRequestLocale } from "next-intl/server";
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
  title: "Communauté Faro School — Échanges & Entraide",
  description: "Rejoignez le groupe de discussion officiel de la communauté Faro School.",
};

interface CommunityPageProps {
  params: Promise<{ locale: string }>;
}

export default async function StudentCommunityPage({ params }: CommunityPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/connexion?next=/${locale}/dashboard/communaute`);
  }

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
          fullName: user.fullName || "Étudiant",
          email: user.email,
          role: user.role,
        }}
        hasAcceptedRules={hasAcceptedRules}
        locale={locale}
      />
    </div>
  );
}
