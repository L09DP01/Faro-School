import {hasCommunityAccess} from "@/lib/community/access";
import {Link} from "@/i18n/navigation";
import {getTranslations} from "next-intl/server";
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

  if(!await hasCommunityAccess(user)){
    const t=await getTranslations({locale,namespace:'communityAccess'});
    return <section className="m-auto max-w-md space-y-4 rounded-2xl border border-line bg-surface p-6 text-center"><h1 className="font-heading text-xl font-bold text-ink">{t('title')}</h1><p className="text-muted-faro">{t('description')}</p><Link href="/formations" className="inline-flex rounded-xl bg-orange px-5 py-3 font-semibold text-white">{t('browse')}</Link></section>;
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
