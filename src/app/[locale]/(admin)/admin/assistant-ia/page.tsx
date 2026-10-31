import {Link} from "@/i18n/navigation";
import {getAuthorCourseContexts} from "@/lib/messaging/course-context";
import {CourseContextEditor} from "@/components/admin/ai/CourseContextEditor";
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
  searchParams:Promise<{tab?:string;courseId?:string}>;
}

export default async function AdminAssistantIaPage({ params,searchParams }: AdminAssistantIaPageProps) {
  const { locale } = await params;
  const user = await requireStaff(locale);

  const search=await searchParams,tab=search.tab==='settings'?'settings':'courses',ht=locale==='ht';
  const navigation=<nav className="flex gap-3 mb-6 border-b border-line pb-3"><Link className={tab==='courses'?'font-semibold text-orange':'text-navy'} href="/admin/assistant-ia?tab=courses">{ht?'Rezime kou yo':'Résumés des cours'}</Link><Link className={tab==='settings'?'font-semibold text-orange':'text-navy'} href="/admin/assistant-ia?tab=settings">{ht?'Paramèt asistan mwen':'Réglages de mon assistant'}</Link></nav>;
  if(tab==='courses'){const data=await getAuthorCourseContexts(user.id).catch(()=>({courses:[],unavailable:true}));return <div>{navigation}<CourseContextEditor courses={data.courses} unavailable={data.unavailable} locale={locale} selectedId={search.courseId}/></div>;}
  const res = await getInstructorAiDataAction(user.id);
  if(!res.success)return <div>{navigation}<p role="alert" className="text-red">{ht?'Paramèt yo pa disponib.':'Réglages indisponibles.'}</p></div>;
  const data = res.data;

  return (
    <div>{navigation}<InstructorAiSettingsClient
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
    /></div>
  );
}
