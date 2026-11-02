"use client";

import { useState, useTransition, useEffect } from "react";
import type { StudentItem, AdminCourseOption, StudentCourseEnrollment } from "@/lib/admin/student-types";
import { grantCourseAccessAction, revokeCourseAccessAction } from "@/app/actions/admin-students";

interface AdminStudentsClientProps {
  initialStudents: StudentItem[];
  availableCourses: AdminCourseOption[];
  isInstructor?: boolean;
  locale: string;
}

export function AdminStudentsClient({
  initialStudents,
  availableCourses,
  isInstructor = false,
  locale,
}: AdminStudentsClientProps) {
  const [students, setStudents] = useState<StudentItem[]>(initialStudents);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [isPending, startTransition] = useTransition();

  // Detail Drawer state (480px wide)
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);
  const [drawerTab, setDrawerTab] = useState<"courses" | "payments">("courses");

  // Grant course form state
  const [selectedCourseToGrant, setSelectedCourseToGrant] = useState("");
  const [grantNote, setGrantNote] = useState("");
  const [grantError, setGrantError] = useState<string | null>(null);

  // Revoke modal state
  const [revokeTarget, setRevokeTarget] = useState<StudentCourseEnrollment | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  // Notification state
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const isHt = locale === "ht";

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Close drawer and modal with Escape
  useEffect(() => {
    if (!selectedStudent && !revokeTarget) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (revokeTarget) {
          setRevokeTarget(null);
        } else if (selectedStudent) {
          setSelectedStudent(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedStudent, revokeTarget]);

  // Filter students
  const filteredStudents = students.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    if (isInstructor) {
      return s.fullName.toLowerCase().includes(q);
    }
    return (
      s.fullName.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.phone.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Aggregate stats
  const totalStudents = students.length;
  const totalEnrollments = students.reduce((acc, s) => acc + s.coursesCount, 0);
  const avgCourses = totalStudents > 0 ? (totalEnrollments / totalStudents).toFixed(1) : "0";

  // Courses not yet enrolled for the currently selected student
  const nonEnrolledCourses = selectedStudent
    ? availableCourses.filter(
        (ac) => !selectedStudent.enrollments.some((e) => e.courseId === ac.id)
      )
    : [];

  // Handler for granting a course
  const handleGrantCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedCourseToGrant) {
      setGrantError(isHt ? "Tanpri chwazi yon fòmasyon." : "Veuillez sélectionner une formation.");
      return;
    }
    setGrantError(null);

    const targetCourse = availableCourses.find((c) => c.id === selectedCourseToGrant);
    if (!targetCourse) return;

    startTransition(async () => {
      const res = await grantCourseAccessAction(
        selectedStudent.id,
        selectedCourseToGrant,
        grantNote.trim()
      );

      if (res.success) {
        const newEnrollment: StudentCourseEnrollment = {
          id: `enr-${Date.now()}`,
          courseId: targetCourse.id,
          slug: targetCourse.slug,
          titleFr: targetCourse.titleFr,
          titleHt: targetCourse.titleHt,
          enrolledAt: new Date().toISOString(),
          note: grantNote.trim() || (isHt ? "Aksè akòde manyèlman" : "Accès accordé manuellement"),
        };

        const updatedStudent: StudentItem = {
          ...selectedStudent,
          coursesCount: selectedStudent.coursesCount + 1,
          enrollments: [newEnrollment, ...selectedStudent.enrollments],
        };

        setSelectedStudent(updatedStudent);
        setStudents((prev) =>
          prev.map((s) => (s.id === selectedStudent.id ? updatedStudent : s))
        );

        setSelectedCourseToGrant("");
        setGrantNote("");
        showNotification(
          isHt
            ? `Fòmasyon "${targetCourse.titleFr}" akòde bay ${selectedStudent.fullName} avèk siksè !`
            : `Formation "${targetCourse.titleFr}" accordée à ${selectedStudent.fullName} avec succès !`
        );
      } else {
        setGrantError(res.error || (isHt ? "Erè pandan operasyon an." : "Erreur lors de l'opération."));
      }
    });
  };

  // Handler for revoking a course
  const handleRevokeConfirm = () => {
    if (!selectedStudent || !revokeTarget) return;

    startTransition(async () => {
      const res = await revokeCourseAccessAction(
        selectedStudent.id,
        revokeTarget.courseId,
        revokeReason.trim()
      );

      if (res.success) {
        const updatedStudent: StudentItem = {
          ...selectedStudent,
          coursesCount: Math.max(0, selectedStudent.coursesCount - 1),
          enrollments: selectedStudent.enrollments.filter(
            (e) => e.courseId !== revokeTarget.courseId
          ),
        };

        setSelectedStudent(updatedStudent);
        setStudents((prev) =>
          prev.map((s) => (s.id === selectedStudent.id ? updatedStudent : s))
        );

        setRevokeTarget(null);
        setRevokeReason("");
        showNotification(
          isHt
            ? `Aksè nan fòmasyon "${revokeTarget.titleFr}" revoke.`
            : `Accès à la formation "${revokeTarget.titleFr}" révoqué avec succès.`
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          role="status"
          className={`flex items-center justify-between rounded-xl border p-4 text-xs font-semibold shadow-sm transition-all ${
            notification.type === "success"
              ? "border-ok/30 bg-ok-tint text-ok"
              : "border-red/30 bg-red-tint text-red"
          }`}
        >
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-bold hover:opacity-75 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current rounded p-0.5"
            aria-label="Fermer la notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <nav aria-label="Fil d'Ariane" className="text-xs text-muted-faro flex items-center gap-1.5 mb-1.5">
            <span>Administration</span>
            <span aria-hidden="true">/</span>
            <span className="text-ink font-medium" aria-current="page">Élèves</span>
          </nav>
          <h1 className="font-heading font-bold text-2xl sm:text-[30px] leading-tight text-ink">
            {isHt ? "Jesyon Elèv yo" : "Gestion des Élèves"}
          </h1>
          <p className="mt-1 text-sm text-muted-faro font-sans">
            {isHt
              ? "Lis elèv ki enskri yo, fòmasyon yo swiv, epi opsyon pou bay oswa retire aksè manyèlman."
              : "Consultez la liste des apprenants, leurs inscriptions, et accordez ou révoquez manuellement l'accès aux formations."}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[18px] border border-line bg-surface p-6 shadow-card space-y-2">
          <p className="text-xs font-heading font-semibold uppercase tracking-wider text-muted-faro">
            {isHt ? "Total elèv" : "Apprenants inscrits"}
          </p>
          <p className="text-2xl font-heading font-bold text-ink">{totalStudents}</p>
        </div>
        <div className="rounded-[18px] border border-line bg-surface p-6 shadow-card space-y-2">
          <p className="text-xs font-heading font-semibold uppercase tracking-wider text-muted-faro">
            {isHt ? "Enskripsyon aktif" : "Inscriptions actives"}
          </p>
          <p className="text-2xl font-heading font-bold text-ink">
            {totalEnrollments} <span className="text-xs font-normal text-muted-faro">{isHt ? "kou" : "cours"}</span>
          </p>
        </div>
        <div className="rounded-[18px] border border-line bg-surface p-6 shadow-card space-y-2">
          <p className="text-xs font-heading font-semibold uppercase tracking-wider text-muted-faro">
            {isHt ? "Mwayèn kou / elèv" : "Moyenne cours / apprenant"}
          </p>
          <p className="text-2xl font-heading font-bold text-ink">
            {avgCourses} <span className="text-xs font-normal text-muted-faro">{isHt ? "fòmasyon" : "formations"}</span>
          </p>
        </div>
      </div>

      {/* Unified White Card: Search + Table */}
      <div className="rounded-[18px] border border-line bg-surface shadow-card overflow-hidden">
        {/* Search Bar Top */}
        <div className="p-4 border-b border-line">
          <div className="relative max-w-md">
            <svg
              className="w-4 h-4 text-muted-faro absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={
                isInstructor
                  ? isHt
                    ? "Chèche yon elèv pa non li..."
                    : "Rechercher un apprenant par nom..."
                  : isHt
                  ? "Chèche pa non, imel oswa telefòn..."
                  : "Rechercher par nom, email ou numéro de téléphone..."
              }
              aria-label={isHt ? "Chèche yon elèv" : "Rechercher un apprenant"}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-line bg-bg text-ink placeholder:text-muted-faro focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition-all"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-bg/50 text-muted-faro font-heading font-semibold">
              <tr>
                <th scope="col" className="px-5 py-3.5">{isHt ? "Elèv" : "Apprenant"}</th>
                {!isInstructor && (
                  <>
                    <th scope="col" className="px-5 py-3.5">{isHt ? "Imel" : "Email"}</th>
                    <th scope="col" className="px-5 py-3.5">{isHt ? "Telefòn" : "Téléphone"}</th>
                  </>
                )}
                <th scope="col" className="px-5 py-3.5">{isHt ? "Fòmasyon" : "Formations"}</th>
                {isInstructor && (
                  <>
                    <th scope="col" className="px-5 py-3.5">{isHt ? "Pwogresyon" : "Progression"}</th>
                    <th scope="col" className="px-5 py-3.5">{isHt ? "Dènye aktivite" : "Dernière activité"}</th>
                  </>
                )}
                <th scope="col" className="px-5 py-3.5">{isHt ? "Dat enskripsyon" : "Inscription"}</th>
                <th scope="col" className="px-5 py-3.5 text-right">{isHt ? "Aksyon" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={isInstructor ? 6 : 6} className="px-5 py-12 text-center text-xs text-muted-faro">
                    {isHt ? "Nou pa jwenn okenn elèv." : "Aucun élève trouvé."}
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((s) => {
                  const initials = s.fullName
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase() || "EL";
                  return (
                    <tr key={s.id} className="hover:bg-bg/40 transition-colors">
                      {/* Name & Avatar */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-tint text-blue font-heading font-bold text-xs border border-blue/20">
                            {initials}
                          </div>
                          <span className="font-heading font-semibold text-ink text-xs">{s.fullName}</span>
                        </div>
                      </td>

                      {/* Email & Phone - Hidden for instructors */}
                      {!isInstructor && (
                        <>
                          <td className="px-5 py-3.5 font-mono text-muted-faro">
                            {s.email || "—"}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-muted-faro">
                            {s.phone || "—"}
                          </td>
                        </>
                      )}

                      {/* Enrolled Courses count */}
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center rounded-lg bg-bg border border-line px-2.5 py-1 text-[11px] font-semibold text-ink">
                          {s.coursesCount} {s.coursesCount > 1 ? (isHt ? "fòmasyon" : "formations") : isHt ? "fòmasyon" : "formation"}
                        </span>
                      </td>

                      {/* Progression & Last Activity for Instructors */}
                      {isInstructor && (
                        <>
                          <td className="px-5 py-3.5">
                            <div className="w-28 space-y-1">
                              <div className="flex justify-between text-[11px] font-medium text-ink">
                                <span>{s.progressPercent===undefined?"—":`${s.progressPercent}%`}</span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                                <div
                                  className="h-full bg-orange rounded-full transition-all duration-300"
                                  style={{ width: `${s.progressPercent ?? 0}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-muted-faro text-[11px]">
                            {s.lastActivityAt
                              ? new Date(s.lastActivityAt).toLocaleDateString(isHt ? "ht-HT" : "fr-FR", {
                                  day: "numeric",
                                  month: "short",
                                })
                              : "—"}
                          </td>
                        </>
                      )}

                      {/* Date */}
                      <td className="px-5 py-3.5 text-muted-faro">
                        {new Date(s.createdAt).toLocaleDateString(isHt ? "ht-HT" : "fr-FR", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isInstructor && (
                            <a
                              href={`/${locale}/admin/messages?new=1&studentId=${s.id}`}
                              className="px-2.5 py-1.5 text-xs font-heading font-semibold rounded-lg bg-orange/10 text-orange hover:bg-orange/20 border border-orange/20 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange"
                            >
                              {isHt ? "Kontakte" : "Contacter"}
                            </a>
                          )}
                          <button
                            onClick={() => {
                              setSelectedStudent(s);
                              setDrawerTab("courses");
                            }}
                            className="px-3 py-1.5 text-xs font-heading font-semibold rounded-lg border border-line bg-surface text-ink hover:bg-bg transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
                          >
                            {isInstructor ? (isHt ? "Detay" : "Détails") : isHt ? "Gere / Detay" : "Gérer / Détails"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-muted-faro bg-surface">
            <span>
              Page {currentPage} {isHt ? "sou" : "sur"} {totalPages} ({filteredStudents.length} {isHt ? "rezilta" : "résultats"})
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-line hover:bg-bg disabled:opacity-40 transition-colors font-semibold text-ink"
              >
                {isHt ? "Anvan" : "Précédent"}
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-line hover:bg-bg disabled:opacity-40 transition-colors font-semibold text-ink"
              >
                {isHt ? "Apre" : "Suivant"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL DRAWER: Right-side Drawer 480px Wide */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-ink/60 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-drawer-title"
            className="h-full w-full max-w-[480px] border-l border-line bg-surface p-6 sm:p-7 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200"
          >
            <div>
              {/* Drawer Header */}
              <div className="flex items-start justify-between border-b border-line pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-tint text-blue font-heading font-bold text-sm border border-blue/20">
                    {selectedStudent.fullName
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase() || "EL"}
                  </div>
                  <div>
                    <h2 id="student-drawer-title" className="font-heading font-bold text-base text-ink">
                      {selectedStudent.fullName}
                    </h2>
                    {!isInstructor && (
                      <p className="text-xs text-muted-faro font-mono mt-0.5">
                        {selectedStudent.email} {selectedStudent.phone && `• ${selectedStudent.phone}`}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-faro mt-0.5">
                      {isHt ? "Enskri depi :" : "Inscrit le :"} {new Date(selectedStudent.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="rounded-lg p-1.5 text-muted-faro hover:bg-bg hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
                  aria-label="Fermer le panneau"
                >
                  ✕
                </button>
              </div>

              {/* Tabs - Payments hidden for instructors */}
              <div className="mt-4 flex border-b border-line">
                <button
                  onClick={() => setDrawerTab("courses")}
                  className={`border-b-2 px-4 py-2.5 text-xs font-heading font-semibold transition-colors focus-visible:outline-none ${
                    drawerTab === "courses"
                      ? "border-blue text-blue"
                      : "border-transparent text-muted-faro hover:text-ink"
                  }`}
                >
                  {isHt ? "Formations ak Aksè" : "Formations & Accès"} ({selectedStudent.enrollments.length})
                </button>
                {!isInstructor && (
                  <button
                    onClick={() => setDrawerTab("payments")}
                    className={`border-b-2 px-4 py-2.5 text-xs font-heading font-semibold transition-colors focus-visible:outline-none ${
                      drawerTab === "payments"
                        ? "border-blue text-blue"
                        : "border-transparent text-muted-faro hover:text-ink"
                    }`}
                  >
                    {isHt ? "Peman & Kòmand" : "Paiements & Commandes"} ({selectedStudent.payments.length})
                  </button>
                )}
              </div>

              {/* Tab 1: Formations & Manual Grant */}
              {drawerTab === "courses" && (
                <div className="mt-5 space-y-6">
                  {/* Instructor Direct Contact CTA */}
                  {isInstructor && (
                    <div className="rounded-2xl border border-orange/20 bg-orange/5 p-4 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-heading font-bold text-ink">
                          {isHt ? "Mesaj Prive" : "Messagerie Directe"}
                        </p>
                        <p className="text-[11px] text-muted-faro">
                          {isHt
                            ? "Ekri elèv sa a dirèkteman nan espas mesaj ou a."
                            : "Communiquez directement avec cet apprenant via la messagerie sécurisée."}
                        </p>
                      </div>
                      <a
                        href={`/${locale}/admin/messages?new=1&studentId=${selectedStudent.id}`}
                        className="px-3 py-1.5 rounded-xl bg-orange hover:bg-orange-strong text-white text-xs font-heading font-semibold shadow-orange transition-all shrink-0"
                      >
                        {isHt ? "Ekri yon mesaj" : "Envoyer un message"}
                      </a>
                    </div>
                  )}

                  {/* Current Enrollments */}
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-muted-faro">
                      {isHt ? "Kou elèv sa a gen aksè ladan yo" : "Formations actuellement accessibles"}
                    </h3>

                    <div className="space-y-2">
                      {selectedStudent.enrollments.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-line p-5 text-center text-xs text-muted-faro bg-bg/40">
                          {isHt ? "Elèv sa a poko enskri nan okenn fòmasyon." : "Cet apprenant n'a accès à aucune formation pour le moment."}
                        </div>
                      ) : (
                        selectedStudent.enrollments.map((enr) => (
                          <div
                            key={enr.courseId}
                            className="flex items-center justify-between rounded-xl border border-line bg-surface p-3.5 text-xs shadow-sm"
                          >
                            <div className="space-y-0.5 max-w-[260px]">
                              <p className="font-heading font-semibold text-ink truncate">
                                {isHt && enr.titleHt ? enr.titleHt : enr.titleFr}
                              </p>
                              <p className="text-[11px] text-muted-faro">
                                {isHt ? "Depi le :" : "Inscrit le :"} {new Date(enr.enrolledAt).toLocaleDateString()}
                              </p>
                              {enr.note && (
                                <p className="text-[10px] text-blue font-medium italic">
                                  Note : {enr.note}
                                </p>
                              )}
                            </div>
                            {!isInstructor ? (
                              <button
                                onClick={() => {
                                  setRevokeTarget(enr);
                                  setRevokeReason("");
                                }}
                                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-red/30 text-red hover:bg-red-tint transition-colors"
                              >
                                {isHt ? "Retire aksè" : "Révoquer"}
                              </button>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-ok-tint text-ok border border-ok/20">
                                {isHt ? "Aktif" : "Actif"}
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Manual Grant Section - Admin Only */}
                  {!isInstructor && (
                    <div className="rounded-2xl border border-line bg-bg p-5 space-y-3">
                      <div>
                        <h4 className="text-xs font-heading font-bold text-ink flex items-center gap-1.5">
                          <svg className="h-4 w-4 text-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          <span>{isHt ? "Bay yon fòmasyon manyèlman" : "Accorder une formation manuellement"}</span>
                        </h4>
                        <p className="mt-0.5 text-[11px] text-muted-faro leading-relaxed font-sans">
                          {isHt
                            ? "Sa ap kreye yon enskripsyon imedya ki pral parèt nan tablo elèv la."
                            : "Crée une inscription immédiate qui apparaîtra dans le tableau de bord de l'élève."}
                        </p>
                      </div>

                      <form onSubmit={handleGrantCourse} className="space-y-3">
                        {grantError && (
                          <div className="rounded-lg border border-red/30 bg-red-tint p-2 text-xs text-red font-medium">
                            {grantError}
                          </div>
                        )}

                        <div className="space-y-1">
                          <label className="text-[11px] font-heading font-semibold text-ink">
                            {isHt ? "Chwazi fòmasyon an" : "Sélectionner la formation"} *
                          </label>
                          <select
                            value={selectedCourseToGrant}
                            onChange={(e) => setSelectedCourseToGrant(e.target.value)}
                            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
                          >
                            <option value="">{isHt ? "-- Chwazi yon kou disponib --" : "-- Choisir une formation disponible --"}</option>
                            {nonEnrolledCourses.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.titleFr} ({c.priceHtg} HTG)
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-heading font-semibold text-ink">
                            {isHt ? "Nòt administratif" : "Motif ou note administrative"}
                          </label>
                          <input
                            type="text"
                            value={grantNote}
                            onChange={(e) => setGrantNote(e.target.value)}
                            placeholder={isHt ? "Eg: Bousdetid, Peman lajan kach..." : "Ex: Bourse d'études, Paiement en espèces..."}
                            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink placeholder:text-muted-faro focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isPending || !selectedCourseToGrant}
                          className="w-full rounded-xl bg-blue py-2.5 text-xs font-heading font-semibold text-white hover:bg-blue/90 transition-colors disabled:opacity-50 shadow-sm"
                        >
                          {isPending
                            ? isHt
                              ? "N ap aktive..."
                              : "Activation en cours..."
                            : isHt
                              ? "Valide epi Bay Aksè a"
                              : "Valider et Accorder l'accès"}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Payments History - Admin Only */}
              {!isInstructor && drawerTab === "payments" && (
                <div className="mt-5 space-y-3">
                  {selectedStudent.payments.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-line p-6 text-center text-xs text-muted-faro bg-bg/40">
                      {isHt ? "Pa gen okenn peman ki anrejistre pou elèv sa a." : "Aucune transaction enregistrée pour cet élève."}
                    </div>
                  ) : (
                    selectedStudent.payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-xl border border-line bg-surface p-3.5 text-xs shadow-sm"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-ink">#{p.orderReference}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                p.provider === "moncash"
                                  ? "bg-red-tint text-red border border-red/20"
                                  : "bg-orange-tint text-orange border border-orange/20"
                              }`}
                            >
                              {p.provider}
                            </span>
                          </div>
                          <p className="text-muted-faro truncate max-w-[200px]">{p.courseTitle}</p>
                          <p className="text-[11px] text-muted-faro">
                            {new Date(p.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right space-y-0.5">
                          <p className="font-heading font-bold text-ink">{p.amountHtg} HTG</p>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              p.status === "validated"
                                ? "bg-ok-tint text-ok border border-ok/30"
                                : p.status === "awaiting_validation"
                                  ? "bg-orange-tint text-orange border border-orange/30"
                                  : "bg-red-tint text-red border border-red/30"
                            }`}
                          >
                            {p.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Close footer */}
            <div className="mt-6 border-t border-line pt-4 text-right">
              <button
                onClick={() => setSelectedStudent(null)}
                className="px-5 py-2 text-xs font-heading font-semibold rounded-xl border border-line text-ink hover:bg-bg transition-colors"
              >
                {isHt ? "Fèmen" : "Fermer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Confirmation Modal */}
      {revokeTarget && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="revoke-dialog-title"
            className="w-full max-w-md rounded-[18px] border border-line bg-surface p-7 shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-3 text-red">
              <div className="w-10 h-10 rounded-full bg-red-tint border border-red/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 id="revoke-dialog-title" className="font-heading font-bold text-base text-ink">
                {isHt ? "Retire aksè nan fòmasyon an ?" : "Révoquer l'accès à la formation ?"}
              </h2>
            </div>

            <p className="text-xs text-muted-faro font-sans leading-relaxed">
              {isHt
                ? `Èske ou vle retire aksè ${selectedStudent.fullName} nan kou "${revokeTarget.titleFr}" la ? Aksyon sa a ap anrejistre nan odit la.`
                : `Voulez-vous retirer l'accès de ${selectedStudent.fullName} à la formation "${revokeTarget.titleFr}" ? Cette action sera consignée dans le journal d'audit.`}
            </p>

            <div className="space-y-1.5">
              <label htmlFor="revoke-reason-input" className="text-xs font-heading font-semibold text-ink">
                {isHt ? "Rezon refi / revokasyon :" : "Motif de la révocation :"}
              </label>
              <input
                id="revoke-reason-input"
                type="text"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder={isHt ? "Eg: Ranbousman, demand elèv..." : "Ex: Remboursement accordé, annulation..."}
                className="w-full rounded-xl border border-line bg-bg px-3.5 py-2 text-xs text-ink placeholder:text-muted-faro focus:outline-none focus:border-red focus:ring-2 focus:ring-red/20"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setRevokeTarget(null)}
                className="px-4 py-2 rounded-xl border border-line text-xs font-semibold text-ink hover:bg-bg transition-colors"
              >
                {isHt ? "Anile" : "Annuler"}
              </button>
              <button
                onClick={handleRevokeConfirm}
                disabled={isPending}
                className="px-5 py-2 rounded-xl bg-red text-white text-xs font-heading font-semibold hover:bg-red/90 transition-colors disabled:opacity-50 shadow-sm"
              >
                {isPending ? (isHt ? "N ap retire l..." : "Révocation...") : isHt ? "Konfime revokasyon" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
