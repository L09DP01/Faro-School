import { requireAdmin } from "@/lib/auth";
import {
  getMessagingSupervisionStats,
  getGlobalAiSettings,
  getBreakGlassAuditLogs,
} from "@/lib/admin/messaging-supervision";
import { getStaffConversations } from "@/lib/messaging/data";
import { getAdminStudentsList } from "@/lib/admin/students";
import { AdminMessagingSupervisionClient } from "@/components/admin/supervision/AdminMessagingSupervisionClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Supervision Messagerie & IA | Faro School Admin",
  description: "Métriques des échanges pédagogiques, Kill Switch IA et accès superviseur.",
  robots: { index: false, follow: false },
};

interface AdminMessageriePageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminMessageriePage({ params }: AdminMessageriePageProps) {
  const { locale } = await params;
  const admin = await requireAdmin(locale);

  const [stats, settings, conversations, students, breakGlassLogs] = await Promise.all([
    getMessagingSupervisionStats("7d"),
    getGlobalAiSettings(),
    getStaffConversations(admin.id, true),
    getAdminStudentsList(),
    getBreakGlassAuditLogs(),
  ]);

  return (
    <AdminMessagingSupervisionClient
      aiConfigured={Boolean(process.env.GEMINI_API_KEY||process.env.ANTHROPIC_API_KEY)}
      initialStats={stats}
      initialSettings={settings}
      conversations={conversations}
      students={students}
      breakGlassLogs={breakGlassLogs}
      currentAdminId={admin.id}
      locale={locale}
    />
  );
}
