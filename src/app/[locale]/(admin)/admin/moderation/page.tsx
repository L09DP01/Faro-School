import { requireAdmin } from "@/lib/auth";
import {
  getModerationReports,
  getMutedAndBannedUsers,
  getWordFilterSettings,
  getCommunityRulesSettings,
  getMockAuditLogs,
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

  const [reports, sanctions, wordFilters, rules, flags] = await Promise.all([
    getModerationReports("all"),
    getMutedAndBannedUsers(),
    getWordFilterSettings(),
    getCommunityRulesSettings(),
    getModerationFlags("all"),
  ]);

  const auditLogs = getMockAuditLogs();

  return (
    <AdminModerationClient
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
