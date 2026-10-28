import { requireStaff } from "@/lib/auth";
import { getInstructorAiDataAction } from "@/app/actions/instructor-ai";
import { InstructorAiSettingsClient } from "@/components/admin/ai/InstructorAiSettingsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Assistant IA | Faro School Admin",
  description: "Personnalisez votre assistant pédagogique IA, son ton et sa base de connaissances.",
  robots: { index: false, follow: false },
};

interface AdminAssistantIaPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminAssistantIaPage({ params }: AdminAssistantIaPageProps) {
  const { locale } = await params;
  const user = await requireStaff(locale);

  const res = await getInstructorAiDataAction(user.id);
  const data = res.data;

  return (
    <InstructorAiSettingsClient
      initialSettings={
        data?.settings || {
          enabled: true,
          name: `Assistant de ${user.fullName || "Formateur"}`,
          tone: "friendly",
          languages: ["fr", "ht"],
          greeting: `Bonjour ! Je suis l'assistant de ${user.fullName || "votre formateur"}.`,
          customInstructions: "Encourage les élèves et reste concis.",
          knowledgeBase: { faq: [], snippets: [] },
          alwaysEscalate: ["remboursement", "paiement", "moncash", "natcash", "certificat", "note"],
          confidenceThreshold: 0.75,
        }
      }
      initialVersions={data?.versions || []}
      instructorName={user.fullName || "Formateur"}
      isInstructor={user.role === "instructor"}
      locale={locale}
    />
  );
}
