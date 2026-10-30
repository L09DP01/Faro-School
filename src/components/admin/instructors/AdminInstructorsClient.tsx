"use client";

import { useState, useTransition } from "react";
import {
  UserCheck,
  Search,
  Plus,
  ShieldCheck,
  ShieldAlert,
  Mail,
  BookOpen,
  Power,
  RefreshCw,
  Copy,
  Check,
  X,
  ExternalLink,
} from "lucide-react";
import type { InstructorItem } from "@/lib/admin/instructors";
import type { AdminCourseOption } from "@/lib/admin/students";
import {
  createInstructorAction,
  toggleInstructorActiveAction,
  reassignCourseInstructorAction,
  sendInstructorInvitationAction,
} from "@/app/actions/admin-instructors";

interface AdminInstructorsClientProps {
  initialInstructors: InstructorItem[];
  availableCourses: AdminCourseOption[];
  locale: string;
}

export function AdminInstructorsClient({
  initialInstructors,
  availableCourses,
  locale,
}: AdminInstructorsClientProps) {
  const isHt = locale === "ht";
  const [instructors, setInstructors] = useState<InstructorItem[]>(initialInstructors);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "suspended">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [invitationModalData, setInvitationModalData] = useState<{
    instructor: InstructorItem;
    url: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form states for creation
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newBio, setNewBio] = useState("");
  const [newEscalationEmail, setNewEscalationEmail] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Form states for course reassignment
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [targetInstructorId, setTargetInstructorId] = useState("");
  const [reassignNote, setReassignNote] = useState("");
  const [reassignError, setReassignError] = useState<string | null>(null);

  // Filter Logic
  const filteredInstructors = instructors.filter((inst) => {
    if (filterStatus === "active" && !inst.isActive) return false;
    if (filterStatus === "suspended" && inst.isActive) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = inst.fullName.toLowerCase().includes(q);
      const matchEmail = inst.email.toLowerCase().includes(q);
      const matchTitle = inst.title.toLowerCase().includes(q);
      const matchCourse = inst.courses.some((c) => c.titleFr.toLowerCase().includes(q));
      if (!matchName && !matchEmail && !matchTitle && !matchCourse) return false;
    }
    return true;
  });

  const totalCount = instructors.length;
  const activeCount = instructors.filter((i) => i.isActive).length;
  const suspendedCount = instructors.filter((i) => !i.isActive).length;
  const totalAssignedCourses = instructors.reduce((acc, i) => acc + i.coursesCount, 0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Create Instructor Handler
  const handleCreateInstructor = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    startTransition(async () => {
      const res = await createInstructorAction({
        locale: locale === "ht" ? "ht" : "fr",
        fullName: newFullName,
        email: newEmail,
        title: newTitle,
        bio: newBio,
        escalationEmail: newEscalationEmail,
      });

      if (!res.success) {
        setCreateError(res.error || "Erreur de création.");
        return;
      }

      const newInst: InstructorItem = {
        id: res.instructorId || `inst-${Date.now()}`,
        fullName: newFullName,
        email: newEmail,
        title: newTitle,
        bio: newBio,
        escalationEmail: newEscalationEmail || null,
        isActive: true,
        createdAt: new Date().toISOString(),
        coursesCount: 0,
        courses: [],
        lastSeenAt: null,
      };

      setInstructors([newInst, ...instructors]);
      setIsCreateOpen(false);
      setNewFullName("");
      setNewEmail("");
      setNewTitle("");
      setNewBio("");
      setNewEscalationEmail("");
      showToast(isHt ? "Nouvo fòmatè kreye avèk siksè!" : "Nouveau formateur créé avec succès !");
    });
  };

  // 2. Toggle Status Handler
  const handleToggleStatus = async (inst: InstructorItem) => {
    const target = !inst.isActive;
    startTransition(async () => {
      const res = await toggleInstructorActiveAction(inst.id, target);
      if (!res.success) {
        alert(res.error || "Erreur lors de la mise à jour");
        return;
      }
      setInstructors(
        instructors.map((item) => (item.id === inst.id ? { ...item, isActive: target } : item))
      );
      showToast(
        target
          ? isHt ? "Fòmatè reaktive avèk siksè" : "Formateur réactivé avec succès"
          : isHt ? "Fòmatè sispann" : "Formateur suspendu avec succès"
      );
    });
  };

  // 3. Reassign Course Handler
  const handleReassignCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !targetInstructorId) return;
    setReassignError(null);

    startTransition(async () => {
      const res = await reassignCourseInstructorAction(selectedCourseId, targetInstructorId, reassignNote);
      if (!res.success) {
        setReassignError(res.error || "Erreur de réassignation");
        return;
      }

      // Update local state
      const targetCourse = availableCourses.find((c) => c.id === selectedCourseId);
      const courseTitle = targetCourse?.titleFr || "Formation";
      const courseSlug = targetCourse?.slug || "";

      setInstructors(
        instructors.map((inst) => {
          let updatedCourses = inst.courses.filter((c) => c.id !== selectedCourseId);
          if (inst.id === targetInstructorId) {
            updatedCourses = [...updatedCourses, { id: selectedCourseId, titleFr: courseTitle, slug: courseSlug }];
          }
          return {
            ...inst,
            courses: updatedCourses,
            coursesCount: updatedCourses.length,
          };
        })
      );

      setIsReassignOpen(false);
      setSelectedCourseId("");
      setTargetInstructorId("");
      setReassignNote("");
      showToast(isHt ? "Kou a re-asine avèk siksè" : "Formation réassignée avec succès !");
    });
  };

  // 4. Send Invitation Handler
  const handleSendInvitation = async (inst: InstructorItem) => {
    startTransition(async () => {
      const res = await sendInstructorInvitationAction(inst.id);
      if (!res.success) {
        alert(res.error || "Erreur d'invitation");
        return;
      }
      setInvitationModalData({
        instructor: inst,
        url: res.invitationUrl || `${window.location.origin}/fr/reinitialisation-mot-de-passe`,
      });
      setCopiedLink(false);
    });
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-navy-deep text-white shadow-xl flex items-center gap-3 border border-white/20 animate-in fade-in slide-in-from-bottom-3"
        >
          <div className="w-6 h-6 rounded-full bg-ok text-white flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-heading font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header with Title and Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-ink">
              {isHt ? "Jesyon Fòmatè yo" : "Gestion des Formateurs"}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-tint text-sky border border-sky/30">
              {totalCount} {totalCount > 1 ? (isHt ? "fòmatè" : "formateurs") : (isHt ? "fòmatè" : "formateur")}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-faro mt-1">
            {isHt
              ? "Kreye nouvo fòmatè, voye envitasyon, sispann/reaktive, epi asiyen fòmasyon."
              : "Créez de nouveaux formateurs, envoyez des invitations, gérez les statuts et réassignez les cours."}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsReassignOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-line bg-surface hover:bg-surface-subtle text-ink font-heading font-semibold text-xs shadow-subtle transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/30"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue" />
            <span>{isHt ? "Re-asine yon kou" : "Réassigner un cours"}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange hover:bg-orange/95 text-white font-heading font-bold text-xs shadow-subtle transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40"
          >
            <Plus className="w-4 h-4" />
            <span>{isHt ? "Ajoute Fòmatè" : "Nouveau Formateur"}</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Cards (Page 11 pattern) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-surface rounded-2xl border border-line p-5 shadow-card space-y-1">
          <div className="flex items-center justify-between text-muted-faro">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {isHt ? "Total Fòmatè" : "Total Formateurs"}
            </span>
            <UserCheck className="w-4 h-4 text-blue" />
          </div>
          <p className="text-2xl font-heading font-extrabold text-ink">{totalCount}</p>
          <p className="text-[11px] text-muted-faro">Corps enseignant Limyè</p>
        </div>

        {/* KPI 2 */}
        <div className="bg-surface rounded-2xl border border-line p-5 shadow-card space-y-1">
          <div className="flex items-center justify-between text-muted-faro">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {isHt ? "Fòmatè Aktif" : "Formateurs Actifs"}
            </span>
            <ShieldCheck className="w-4 h-4 text-ok" />
          </div>
          <p className="text-2xl font-heading font-extrabold text-ok">{activeCount}</p>
          <p className="text-[11px] text-muted-faro">Accès complet à la plateforme</p>
        </div>

        {/* KPI 3 */}
        <div className="bg-surface rounded-2xl border border-line p-5 shadow-card space-y-1">
          <div className="flex items-center justify-between text-muted-faro">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {isHt ? "Sispann" : "Suspendus"}
            </span>
            <ShieldAlert className="w-4 h-4 text-red" />
          </div>
          <p className="text-2xl font-heading font-extrabold text-red">{suspendedCount}</p>
          <p className="text-[11px] text-muted-faro">Accès temporairement bloqué</p>
        </div>

        {/* KPI 4 */}
        <div className="bg-surface rounded-2xl border border-line p-5 shadow-card space-y-1">
          <div className="flex items-center justify-between text-muted-faro">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {isHt ? "Kou Encadrés" : "Cours Encadrés"}
            </span>
            <BookOpen className="w-4 h-4 text-orange" />
          </div>
          <p className="text-2xl font-heading font-extrabold text-ink">{totalAssignedCourses}</p>
          <p className="text-[11px] text-muted-faro">Attribués aux instructeurs</p>
        </div>
      </div>

      {/* Main Content Card (Filter Pills + Search + Table) */}
      <div className="bg-surface rounded-[24px] border border-line shadow-card overflow-hidden">
        {/* Filter bar */}
        <div className="p-4 sm:p-5 border-b border-line flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Status Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <button
              type="button"
              onClick={() => setFilterStatus("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-heading font-bold transition-all ${
                filterStatus === "all"
                  ? "bg-navy-deep text-white shadow-subtle"
                  : "bg-surface-subtle text-muted-faro hover:text-ink"
              }`}
            >
              {isHt ? "Tout" : "Tous"} ({totalCount})
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus("active")}
              className={`px-3 py-1.5 rounded-full text-xs font-heading font-bold transition-all ${
                filterStatus === "active"
                  ? "bg-ok text-white shadow-subtle"
                  : "bg-ok-tint text-ok hover:bg-ok/20"
              }`}
            >
              {isHt ? "Aktif" : "Actifs"} ({activeCount})
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus("suspended")}
              className={`px-3 py-1.5 rounded-full text-xs font-heading font-bold transition-all ${
                filterStatus === "suspended"
                  ? "bg-red text-white shadow-subtle"
                  : "bg-red-tint text-red hover:bg-red/20"
              }`}
            >
              {isHt ? "Sispann" : "Suspendus"} ({suspendedCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-faro" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isHt ? "Chèche fòmatè, kou, email..." : "Rechercher nom, cours, email..."}
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-line bg-bg text-ink placeholder:text-muted-faro focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20"
            />
          </div>
        </div>

        {/* Table / List View */}
        {filteredInstructors.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-subtle border border-line flex items-center justify-center mx-auto text-muted-faro">
              <UserCheck className="w-6 h-6" />
            </div>
            <p className="text-sm font-heading font-bold text-ink">
              {isHt ? "Pa gen okenn fòmatè korespondan" : "Aucun formateur trouvé"}
            </p>
            <p className="text-xs text-muted-faro">
              Essayez de modifier votre recherche ou ajoutez un nouveau formateur.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line bg-surface-subtle/50 text-[11px] font-heading font-bold uppercase tracking-wider text-muted-faro">
                  <th className="py-3 px-5">Formateur</th>
                  <th className="py-3 px-4">Titre & Spécialité</th>
                  <th className="py-3 px-4">Formations Enseignées</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-xs">
                {filteredInstructors.map((inst) => {
                  const initials = inst.fullName
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  return (
                    <tr
                      key={inst.id}
                      className={`hover:bg-bg/60 transition-colors ${
                        !inst.isActive ? "bg-red/5" : ""
                      }`}
                    >
                      {/* Name & Email */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 text-white font-heading font-bold text-xs flex items-center justify-center shrink-0 shadow-subtle">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-heading font-bold text-ink truncate">
                              {inst.fullName}
                            </p>
                            <p className="text-[11px] text-muted-faro font-mono truncate">
                              {inst.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Title & Bio */}
                      <td className="py-4 px-4 max-w-xs">
                        <p className="font-semibold text-ink truncate">{inst.title}</p>
                        <p className="text-[11px] text-muted-faro line-clamp-1">{inst.bio}</p>
                        {inst.escalationEmail && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-orange mt-0.5">
                            <Mail className="w-3 h-3" />
                            {inst.escalationEmail}
                          </span>
                        )}
                      </td>

                      {/* Assigned Courses */}
                      <td className="py-4 px-4 max-w-xs">
                        {inst.courses.length === 0 ? (
                          <span className="text-[11px] text-muted-faro italic">
                            Aucun cours assigné
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {inst.courses.map((c) => (
                              <span
                                key={c.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-tint text-blue text-[10px] font-semibold"
                              >
                                <BookOpen className="w-2.5 h-2.5" />
                                <span className="truncate max-w-[120px]">{c.titleFr}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {inst.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-ok-tint text-ok border border-ok/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-ok" />
                            Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-tint text-red border border-red/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-red" />
                            Suspendu
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Send Invitation */}
                          <button
                            type="button"
                            title="Envoyer / Copier lien d'invitation"
                            onClick={() => handleSendInvitation(inst)}
                            disabled={isPending}
                            className="p-1.5 rounded-lg border border-line bg-surface hover:bg-surface-subtle text-muted-faro hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/30"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Suspend / Reactivate */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(inst)}
                            disabled={isPending}
                            title={inst.isActive ? "Suspendre ce formateur" : "Réactiver ce formateur"}
                            className={`p-1.5 rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                              inst.isActive
                                ? "border-red/30 bg-red-tint text-red hover:bg-red/20 focus-visible:ring-red/30"
                                : "border-ok/30 bg-ok-tint text-ok hover:bg-ok/20 focus-visible:ring-ok/30"
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Create Instructor Dialog */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-deep/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-surface border border-line rounded-[24px] p-6 sm:p-7 shadow-card space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-tint text-orange flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <h2 className="text-base font-heading font-bold text-ink">
                  {isHt ? "Kreye yon Nouvo Fòmatè" : "Nouveau Formateur Limyè"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 rounded-lg text-muted-faro hover:text-ink hover:bg-surface-subtle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-red-tint border border-red/30 text-red text-xs font-semibold">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateInstructor} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink">
                  Nom complet *
                </label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="Ex: Jean-Baptiste Formateur"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-line bg-bg text-ink focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink">
                  Adresse email *
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Ex: formateur@faroschool.com"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-line bg-bg text-ink focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink">
                  Titre professionnel & Spécialité *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Spécialiste Marketing Numérique & SEO"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-line bg-bg text-ink focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink">
                  Biographie & Présentation
                </label>
                <textarea
                  rows={3}
                  value={newBio}
                  onChange={(e) => setNewBio(e.target.value)}
                  placeholder="Court résumé du parcours pédagogique et professionnel..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-line bg-bg text-ink focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink">
                  Email d&apos;escalade / Support pédagogique (optionnel)
                </label>
                <input
                  type="email"
                  value={newEscalationEmail}
                  onChange={(e) => setNewEscalationEmail(e.target.value)}
                  placeholder="support.pedagogique@faroschool.com"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-line bg-bg text-ink focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-line text-xs font-heading font-semibold text-muted-faro hover:text-ink hover:bg-surface-subtle"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-xl bg-orange hover:bg-orange/95 text-white font-heading font-bold text-xs shadow-subtle disabled:opacity-50"
                >
                  {isPending ? "Création en cours..." : "Créer le formateur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Reassign Course Dialog */}
      {isReassignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-deep/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-surface border border-line rounded-[24px] p-6 sm:p-7 shadow-card space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-tint text-blue flex items-center justify-center">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <h2 className="text-base font-heading font-bold text-ink">
                  {isHt ? "Re-asine yon Kou bay yon Fòmatè" : "Réassigner un cours à un formateur"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsReassignOpen(false)}
                className="p-1.5 rounded-lg text-muted-faro hover:text-ink hover:bg-surface-subtle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reassignError && (
              <div className="p-3 rounded-xl bg-red-tint border border-red/30 text-red text-xs font-semibold">
                {reassignError}
              </div>
            )}

            <form onSubmit={handleReassignCourse} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink">
                  Sélectionner la formation *
                </label>
                <select
                  required
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-line bg-bg text-ink focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20"
                >
                  <option value="">Sélectionnez un cours...</option>
                  {availableCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.titleFr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink">
                  Nouveau formateur responsable *
                </label>
                <select
                  required
                  value={targetInstructorId}
                  onChange={(e) => setTargetInstructorId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-line bg-bg text-ink focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20"
                >
                  <option value="">Sélectionnez un formateur...</option>
                  {instructors
                    .filter((i) => i.isActive)
                    .map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.fullName} — {inst.title}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink">
                  Note d&apos;audit interne (optionnel)
                </label>
                <input
                  type="text"
                  value={reassignNote}
                  onChange={(e) => setReassignNote(e.target.value)}
                  placeholder="Ex: Remplacement temporaire ou changement de cursus"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-line bg-bg text-ink focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsReassignOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-line text-xs font-heading font-semibold text-muted-faro hover:text-ink hover:bg-surface-subtle"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending || !selectedCourseId || !targetInstructorId}
                  className="px-5 py-2.5 rounded-xl bg-blue hover:bg-blue/95 text-white font-heading font-bold text-xs shadow-subtle disabled:opacity-50"
                >
                  {isPending ? "Mise à jour..." : "Confirmer la réassignation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Invitation / Set Password Link Modal */}
      {invitationModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-deep/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-surface border border-line rounded-[24px] p-6 shadow-card space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-ok-tint text-ok flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <h2 className="text-base font-heading font-bold text-ink">
                  Lien d&apos;activation formateur
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setInvitationModalData(null)}
                className="p-1.5 rounded-lg text-muted-faro hover:text-ink hover:bg-surface-subtle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-faro leading-relaxed">
              Le lien sécurisé ci-dessous permet au formateur{" "}
              <strong className="text-ink">{invitationModalData.instructor.fullName}</strong>{" "}
              de définir son mot de passe et d&apos;accéder immédiatement à son espace.
            </p>

            <div className="p-3 rounded-xl bg-bg border border-line font-mono text-[11px] text-ink break-all select-all flex items-center justify-between gap-2">
              <span className="truncate">{invitationModalData.url}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(invitationModalData.url);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 3000);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-surface border border-line text-xs font-sans font-semibold text-ink shrink-0 hover:bg-surface-subtle flex items-center gap-1"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-ok" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? "Copié !" : "Copier"}</span>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInvitationModalData(null)}
                className="px-5 py-2.5 rounded-xl bg-navy-deep text-white font-heading font-bold text-xs"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
