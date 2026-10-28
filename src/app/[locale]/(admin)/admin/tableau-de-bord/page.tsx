import { requireStaff } from "@/lib/auth";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getAdminCoursesList } from "@/lib/admin/courses";
import { getInstructorDashboardData } from "@/lib/admin/instructor-dashboard";
import { StaffAvailabilityToggle } from "@/components/messaging/StaffAvailabilityToggle";
import {
  Users,
  TrendingUp,
  Award,
  MessageSquare,
  AlertTriangle,
  ArrowRight,
  Plus,
  Sparkles,
  Bot,
} from "lucide-react";

interface InstructorDashboardProps {
  params: Promise<{ locale: string }>;
}

export default async function InstructorDashboardPage({
  params,
}: InstructorDashboardProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireStaff(locale);
  const isHt = locale === "ht";

  const instructorId = user.id;
  const [{ kpis, recentActivity }, courses] = await Promise.all([
    getInstructorDashboardData(instructorId),
    getAdminCoursesList(user.role === "instructor" ? instructorId : undefined),
  ]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-ink tracking-tight">
              {isHt ? "Tablo Bò Fòmatè" : "Tableau de Bord Formateur"}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400/20 text-amber-700 border border-amber-400/30">
              {isHt ? "Espas Pedagojik" : "Espace Pédagogique"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-faro mt-1">
            {isHt
              ? `Byenvini, ${user.fullName || "Fòmatè"}. Swiv pwogresyon elèv ou yo ak aktivite fòmasyon w yo.`
              : `Bienvenue, ${user.fullName || "Formateur"}. Suivez l'évolution de vos cours, apprenants et échanges privés.`}
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* Availability Toggle */}
          <StaffAvailabilityToggle initialAvailable={true} locale={locale} />

          <Link
            href="/admin/formations/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange hover:bg-orange/95 text-white font-heading font-bold text-xs shadow-subtle transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40"
          >
            <Plus className="w-4 h-4" />
            <span>{isHt ? "Kreye yon fòmasyon" : "Nouveau cours"}</span>
          </Link>
        </div>
      </div>

      {/* 5 Instructor KPIs (Strictly Pedagogical - No Revenue / Payments) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* KPI 1: Students */}
        <div className="bg-surface rounded-2xl border border-line p-4 sm:p-5 shadow-card space-y-1">
          <div className="flex items-center justify-between text-muted-faro">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              {isHt ? "Etidyan" : "Apprenants"}
            </span>
            <Users className="w-4 h-4 text-ok" />
          </div>
          <p className="text-2xl font-heading font-extrabold text-ok">{kpis.studentsCount}</p>
          <p className="text-[10px] text-muted-faro truncate">Inscrits à vos cours</p>
        </div>

        {/* KPI 2: Average Progress */}
        <div className="bg-surface rounded-2xl border border-line p-4 sm:p-5 shadow-card space-y-1">
          <div className="flex items-center justify-between text-muted-faro">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              {isHt ? "Pwogresyon" : "Progression"}
            </span>
            <TrendingUp className="w-4 h-4 text-blue" />
          </div>
          <p className="text-2xl font-heading font-extrabold text-blue">
            {kpis.averageProgressPercent}%
          </p>
          <div className="w-full bg-line h-1.5 rounded-full overflow-hidden mt-1">
            <div
              className="bg-blue h-full rounded-full transition-all"
              style={{ width: `${kpis.averageProgressPercent}%` }}
            />
          </div>
        </div>

        {/* KPI 3: Completion Rate */}
        <div className="bg-surface rounded-2xl border border-line p-4 sm:p-5 shadow-card space-y-1">
          <div className="flex items-center justify-between text-muted-faro">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              {isHt ? "Sètifika" : "Taux de fin"}
            </span>
            <Award className="w-4 h-4 text-orange" />
          </div>
          <p className="text-2xl font-heading font-extrabold text-ink">
            {kpis.completionRatePercent}%
          </p>
          <p className="text-[10px] text-muted-faro truncate">Certificats obtenus</p>
        </div>

        {/* KPI 4: Unread Conversations */}
        <div className="bg-surface rounded-2xl border border-line p-4 sm:p-5 shadow-card space-y-1">
          <div className="flex items-center justify-between text-muted-faro">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              {isHt ? "Mesaj non li" : "Messages"}
            </span>
            <MessageSquare className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-2xl font-heading font-extrabold text-ink">
            {kpis.unreadConversationsCount}
          </p>
          <p className="text-[10px] text-muted-faro truncate">Échanges en attente</p>
        </div>

        {/* KPI 5: Escalations Waiting */}
        <div className="bg-surface rounded-2xl border border-line p-4 sm:p-5 shadow-card space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-muted-faro">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              {isHt ? "Eskalad" : "Escalades"}
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-heading font-extrabold text-amber-600">
            {kpis.escalationsWaitingCount}
          </p>
          <p className="text-[10px] text-muted-faro truncate">Urgent (Règle 2 min)</p>
        </div>
      </div>

      {/* Main Grid: Latest Student Activity & Formations Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Latest Student Activity (2 cols) */}
        <div className="lg:col-span-2 bg-surface rounded-[24px] border border-line p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div>
              <h2 className="text-base font-heading font-bold text-ink">
                {isHt ? "Dènye aktivite elèv yo" : "Dernière Activité des Apprenants"}
              </h2>
              <p className="text-xs text-muted-faro mt-0.5">
                {isHt
                  ? "Suiv leson ki fini, sètifika ki delivre ak nouvo mesaj elèv ou yo."
                  : "Progression en direct, leçons complétées et certifications délivrées sur vos cours."}
              </p>
            </div>

            <Link
              href="/admin/eleves"
              className="inline-flex items-center gap-1.5 text-xs font-heading font-semibold text-blue hover:text-blue/80 transition-colors"
            >
              <span>{isHt ? "Wè tout elèv" : "Voir les élèves"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-line/60">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="py-3.5 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-tint text-blue font-heading font-bold text-xs flex items-center justify-center shrink-0 border border-blue/20">
                    {activity.studentName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-semibold text-xs text-ink">
                        {activity.studentName}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg border border-line text-muted-faro">
                        {activity.courseTitle}
                      </span>
                    </div>
                    <p className="text-xs text-muted-faro mt-0.5">{activity.detail}</p>
                  </div>
                </div>

                <span className="text-[10px] text-muted-faro shrink-0 whitespace-nowrap">
                  {new Date(activity.timestamp).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: AI Assistant Shortcut & Courses summary */}
        <div className="space-y-6">
          {/* AI Assistant Quick Card */}
          <div className="bg-gradient-to-br from-orange-tint/80 to-surface rounded-[24px] border border-orange/30 p-5 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange text-white flex items-center justify-center shadow-orange">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-xs text-ink">
                    {isHt ? "Asistan IA Fòmatè" : "Assistant IA Formateur"}
                  </h3>
                  <span className="text-[10px] text-ok font-semibold">● Actif en mode hors-ligne</span>
                </div>
              </div>

              <Link
                href="/admin/assistant-ia"
                className="text-xs font-semibold text-orange hover:text-orange-strong hover:underline"
              >
                Gérer
              </Link>
            </div>

            <p className="text-xs text-muted-faro leading-relaxed">
              Votre assistant répond automatiquement aux étudiants dès que vous êtes indisponible, selon vos consignes.
            </p>

            <Link
              href="/admin/assistant-ia"
              className="inline-flex w-full items-center justify-center gap-2 px-4 py-2 rounded-xl bg-surface border border-line hover:border-orange text-ink font-heading font-semibold text-xs shadow-subtle transition-colors"
            >
              <Bot className="w-3.5 h-3.5 text-orange" />
              <span>Tester dans le bac à sable</span>
            </Link>
          </div>

          {/* Mes Formations List Preview */}
          <div className="bg-surface rounded-[24px] border border-line p-5 shadow-card space-y-3">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-heading font-bold text-xs text-ink">
                {isHt ? "Fòmasyon m yo" : "Mes Formations"} ({courses.length})
              </h3>
              <Link
                href="/admin/formations"
                className="text-[11px] font-semibold text-blue hover:underline"
              >
                Voir tout
              </Link>
            </div>

            <div className="space-y-2">
              {courses.slice(0, 3).map((c) => (
                <div
                  key={c.id}
                  className="p-2.5 rounded-xl border border-line/70 hover:bg-bg transition-colors flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-semibold text-ink truncate">
                      {isHt && c.titleHt ? c.titleHt : c.titleFr}
                    </p>
                    <p className="text-[10px] text-muted-faro">
                      {c.modulesCount || 0} modules • {c.lessonsCount || 0} leçons
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${
                      c.status === "published"
                        ? "bg-ok-tint text-ok border border-ok/20"
                        : "bg-surface border border-line text-muted-faro"
                    }`}
                  >
                    {c.status === "published" ? "Publié" : "Brouillon"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
