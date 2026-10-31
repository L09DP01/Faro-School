import { requireAdmin } from "@/lib/auth";
import {
  getModerationReports,
  getMutedAndBannedUsers,
  getWordFilterSettings,
  getCommunityRulesSettings,
  getModerationAuditLogs,
} from "@/lib/admin/moderation";
import { getModerationFlags } from "@/lib/moderation/flag-service";
import { AdminModerationClient } from "@/components/admin/moderation/AdminModerationClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Modération Communauté | Faro School Admin",
  description: "File des signalements, gestion des mutes/bans et filtres de sécurité.",
  robots: { index: false, follow: false },
};

interface AdminModerationPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminModerationPage({ params }: AdminModerationPageProps) {
  const { locale } = await params;
  await requireAdmin(locale);

  const results=await Promise.allSettled([getModerationReports('all'),getMutedAndBannedUsers(),getWordFilterSettings(),getCommunityRulesSettings(),getModerationFlags('all'),getModerationAuditLogs()]);
  const sections=['reports','sanctions','filters','rules','flags','audit'];
  const unavailable=results.flatMap((r,i)=>r.status==='rejected'?[sections[i]]:[]);
  const read=<T,>(index:number,fallback:T):T=>results[index].status==='fulfilled'?(results[index] as PromiseFulfilledResult<T>).value:fallback;
  const reports=read(0,[]),sanctions=read(1,{mutedUsers:[],bannedUsers:[]}),wordFilters=read(2,{fr:[],ht:[]}),rules=read(3,{fr:'',ht:''}),flags=read(4,[]),auditLogs=read(5,[]);

  return (
    <AdminModerationClient
      unavailableSections={unavailable}
      initialReports={reports}
      initialMuted={sanctions.mutedUsers}
      initialBanned={sanctions.bannedUsers}
      initialWordFilters={wordFilters}
      initialRules={rules}
      initialFlags={flags}
      auditLogs={auditLogs}
      locale={locale}
    />
  );
}
