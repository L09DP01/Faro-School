"use client";

import { useState, useTransition } from "react";
import {
  ShieldAlert,
  Trash2,
  VolumeX,
  Volume2,
  UserX,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Filter,
  FileText,
  History,
  Check,
  X,
  Save,
  Plus,
  ArrowRight,
  MessageSquare,
} from "lucide-react";
import {
  deleteReportedMessageAction,
  muteReportAuthorAction,
  banReportAuthorAction,
  dismissReportAction,
  unmuteUserAction,
  unbanUserAction,
  updateWordFilterAction,
  updateCommunityRulesAction,
  reviewModerationFlagAction,
  muteUserFromFlagAction,
} from "@/app/actions/admin-moderation";
import type { ModerationFlagRecord } from "@/lib/moderation/flag-service";
import type {
  CommunityReportItem,
  MutedUserItem,
  BannedUserItem,
  WordFilterSettings,
  CommunityRulesSettings,
} from "@/lib/admin/moderation";

interface AdminModerationClientProps {
  initialReports: CommunityReportItem[];
  initialMuted: MutedUserItem[];
  initialBanned: BannedUserItem[];
  initialWordFilters: WordFilterSettings;
  initialRules: CommunityRulesSettings;
  initialFlags?: ModerationFlagRecord[];
  auditLogs: any[];
  locale: string;
}

export function AdminModerationClient({
  initialReports,
  initialMuted,
  initialBanned,
  initialWordFilters,
  initialRules,
  initialFlags = [],
  auditLogs,
  locale,
}: AdminModerationClientProps) {
  const [reports, setReports] = useState<CommunityReportItem[]>(initialReports);
  const [flags, setFlags] = useState<ModerationFlagRecord[]>(initialFlags);
  const [mutedUsers, setMutedUsers] = useState<MutedUserItem[]>(initialMuted);
  const [bannedUsers, setBannedUsers] = useState<BannedUserItem[]>(initialBanned);
  const [wordFilters, setWordFilters] = useState<WordFilterSettings>(initialWordFilters);
  const [rules, setRules] = useState<CommunityRulesSettings>(initialRules);

  const [activeTab, setActiveTab] = useState<
    "reports" | "flags" | "sanctions" | "filters" | "rules" | "audit"
  >("reports");
  const [reportFilter, setReportFilter] = useState<"pending" | "resolved" | "dismissed" | "all">(
    "pending"
  );
  const [flagFilter, setFlagFilter] = useState<"open" | "reviewed" | "dismissed" | "all">("open");

  const [newFrWord, setNewFrWord] = useState("");
  const [newHtWord, setNewHtWord] = useState("");

  const [isPending, startTransition] = useTransition();
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const isHt = locale === "ht";

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Filtered reports
  const filteredReports = reports.filter((r) => {
    if (reportFilter === "all") return true;
    return r.status === reportFilter;
  });

  const pendingReportsCount = reports.filter((r) => r.status === "pending").length;

  // Filtered flags
  const filteredFlags = flags.filter((f) => {
    if (flagFilter === "all") return true;
    return f.status === flagFilter;
  });

  const pendingFlagsCount = flags.filter((f) => f.status === "open").length;

  // Handlers for reports
  const handleDeleteMessage = (reportId: string, messageId: string) => {
    startTransition(async () => {
      const res = await deleteReportedMessageAction(reportId, messageId);
      if (res.success) {
        setReports((prev) =>
          prev.map((r) =>
            r.id === reportId ? { ...r, status: "resolved", messageDeleted: true } : r
          )
        );
        showNotification(
          isHt ? "Mesaj la efase avèk siksè !" : "Message supprimé avec succès !",
          "success"
        );
      } else {
        showNotification(res.error || "Erreur lors de la suppression.", "error");
      }
    });
  };

  const handleMuteAuthor = (
    reportId: string,
    authorId: string,
    duration: "1h" | "24h" | "7d"
  ) => {
    startTransition(async () => {
      const res = await muteReportAuthorAction(reportId, authorId, duration);
      if (res.success) {
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, status: "resolved" } : r))
        );
        showNotification(
          isHt
            ? `Otè a mete an silans pou ${duration} !`
            : `Auteur mis en sourdine pour ${duration} !`,
          "success"
        );
      } else {
        showNotification(res.error || "Erreur de modération.", "error");
      }
    });
  };

  const handleBanAuthor = (reportId: string, authorId: string) => {
    if (
      !confirm(
        isHt
          ? "Èske ou sèten ou vle bani itilizatè sa a nèt sou platfòm nan ?"
          : "Êtes-vous sûr de vouloir bannir définitivement cet utilisateur de la plateforme ?"
      )
    ) {
      return;
    }

    startTransition(async () => {
      const res = await banReportAuthorAction(reportId, authorId);
      if (res.success) {
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, status: "resolved" } : r))
        );
        showNotification(
          isHt ? "Itilizatè a bani nèt !" : "Utilisateur banni définitivement !",
          "success"
        );
      } else {
        showNotification(res.error || "Erreur lors du bannissement.", "error");
      }
    });
  };

  const handleDismissReport = (reportId: string) => {
    startTransition(async () => {
      const res = await dismissReportAction(reportId);
      if (res.success) {
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, status: "dismissed" } : r))
        );
        showNotification(
          isHt ? "Siyalman an klase san swit." : "Signalement classé sans suite.",
          "success"
        );
      } else {
        showNotification(res.error || "Erreur de traitement.", "error");
      }
    });
  };

  // Handlers for flags
  const handleReviewFlag = (flagId: string, status: "reviewed" | "dismissed") => {
    startTransition(async () => {
      const res = await reviewModerationFlagAction(flagId, status);
      if (res.success) {
        setFlags((prev) =>
          prev.map((f) => (f.id === flagId ? { ...f, status } : f))
        );
        showNotification(
          status === "reviewed"
            ? (isHt ? "Drapo trete avèk siksè !" : "Signalement automatique validé / traité !")
            : (isHt ? "Drapo inyore !" : "Signalement automatique classé sans suite."),
          "success"
        );
      } else {
        showNotification(res.error || "Erreur lors du traitement.", "error");
      }
    });
  };

  const handleMuteFromFlag = (flagId: string, userId: string) => {
    startTransition(async () => {
      const res = await muteUserFromFlagAction(userId, "24h", flagId);
      if (res.success) {
        setFlags((prev) =>
          prev.map((f) => (f.id === flagId ? { ...f, status: "reviewed" } : f))
        );
        showNotification(
          isHt
            ? "Itilizatè a mete an silans pou 24h !"
            : "Utilisateur mis en sourdine pour 24 heures !",
          "success"
        );
      } else {
        showNotification(res.error || "Erreur de mise en sourdine.", "error");
      }
    });
  };

  // Handlers for sanctions list
  const handleUnmute = (userId: string) => {
    startTransition(async () => {
      const res = await unmuteUserAction(userId);
      if (res.success) {
        setMutedUsers((prev) => prev.filter((u) => u.id !== userId));
        showNotification(
          isHt ? "Silans lan leve sou itilizatè sa a !" : "Mise en sourdine levée !",
          "success"
        );
      }
    });
  };

  const handleUnban = (userId: string) => {
    startTransition(async () => {
      const res = await unbanUserAction(userId);
      if (res.success) {
        setBannedUsers((prev) => prev.filter((u) => u.id !== userId));
        showNotification(
          isHt ? "Kont itilizatè a retabli !" : "Compte utilisateur réactivé !",
          "success"
        );
      }
    });
  };

  // Word filter tags
  const handleAddWord = (lang: "fr" | "ht") => {
    const val = (lang === "fr" ? newFrWord : newHtWord).trim().toLowerCase();
    if (!val) return;
    if (lang === "fr" && !wordFilters.fr.includes(val)) {
      setWordFilters({ ...wordFilters, fr: [...wordFilters.fr, val] });
      setNewFrWord("");
    } else if (lang === "ht" && !wordFilters.ht.includes(val)) {
      setWordFilters({ ...wordFilters, ht: [...wordFilters.ht, val] });
      setNewHtWord("");
    }
  };

  const handleRemoveWord = (lang: "fr" | "ht", word: string) => {
    if (lang === "fr") {
      setWordFilters({ ...wordFilters, fr: wordFilters.fr.filter((w) => w !== word) });
    } else {
      setWordFilters({ ...wordFilters, ht: wordFilters.ht.filter((w) => w !== word) });
    }
  };

  const handleSaveWordFilters = () => {
    startTransition(async () => {
      const res = await updateWordFilterAction(wordFilters);
      if (res.success) {
        showNotification(
          isHt ? "Filtè mo yo anrejistre !" : "Filtre de mots enregistré avec succès !",
          "success"
        );
      }
    });
  };

  const handleSaveRules = () => {
    startTransition(async () => {
      const res = await updateCommunityRulesAction(rules);
      if (res.success) {
        showNotification(
          isHt ? "Règ kominote yo anrejistre !" : "Règles de la communauté enregistrées !",
          "success"
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
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 text-xs font-semibold shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-4 ${
            notification.type === "success"
              ? "bg-ink text-surface border border-line"
              : "bg-red text-white"
          }`}
        >
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-bold hover:opacity-75 focus-visible:outline-none rounded p-0.5"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-2">
        <nav aria-label="Fil d'Ariane" className="text-xs text-muted-faro flex items-center gap-1.5 mb-1">
          <span>Administration</span>
          <span aria-hidden="true">/</span>
          <span className="text-ink font-medium" aria-current="page">
            {isHt ? "Moderasyon Kominote" : "Modération"}
          </span>
        </nav>
        <h1 className="font-heading font-bold text-2xl sm:text-[28px] text-ink flex items-center gap-2.5">
          <ShieldAlert className="w-6 h-6 text-orange" />
          <span>{isHt ? "Zouti Moderasyon Kominote" : "Modération de la Communauté"}</span>
        </h1>
        <p className="text-xs sm:text-sm text-muted-faro">
          {isHt
            ? "Jere siyalman mesaj yo, aplike sanksyon (silans, bannisman), epi pèsonalize filtè mo ak règleman yo."
            : "Traitez les messages signalés, appliquez des sanctions (silence, bannissement) et éditez les filtres de mots et règles."}
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-line gap-2 overflow-x-auto no-scrollbar pb-1 text-xs font-heading font-semibold">
        <button
          onClick={() => setActiveTab("reports")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-b-2 transition-all whitespace-nowrap ${
            activeTab === "reports"
              ? "border-orange text-orange bg-orange/5"
              : "border-transparent text-muted-faro hover:text-ink hover:bg-surface"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>{isHt ? "Fil Siyalman" : "File des signalements"}</span>
          {pendingReportsCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red text-white text-[10px] font-bold">
              {pendingReportsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("flags")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-b-2 transition-all whitespace-nowrap ${
            activeTab === "flags"
              ? "border-orange text-orange bg-orange/5"
              : "border-transparent text-muted-faro hover:text-ink hover:bg-surface"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>{isHt ? "Flak Otomatik (Telefòn/WhatsApp)" : "Flags automatiques"}</span>
          {pendingFlagsCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red text-white text-[10px] font-bold">
              {pendingFlagsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("sanctions")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-b-2 transition-all whitespace-nowrap ${
            activeTab === "sanctions"
              ? "border-orange text-orange bg-orange/5"
              : "border-transparent text-muted-faro hover:text-ink hover:bg-surface"
          }`}
        >
          <VolumeX className="w-4 h-4" />
          <span>{isHt ? "Manm Sanksyone" : "Membres sanctionnés"}</span>
          <span className="px-2 py-0.5 rounded-full bg-line text-muted-faro text-[10px]">
            {mutedUsers.length + bannedUsers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("filters")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-b-2 transition-all whitespace-nowrap ${
            activeTab === "filters"
              ? "border-orange text-orange bg-orange/5"
              : "border-transparent text-muted-faro hover:text-ink hover:bg-surface"
          }`}
        >
          <Filter className="w-4 h-4" />
          <span>{isHt ? "Filtè Mo (FR & KR)" : "Filtre de mots"}</span>
        </button>

        <button
          onClick={() => setActiveTab("rules")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-b-2 transition-all whitespace-nowrap ${
            activeTab === "rules"
              ? "border-orange text-orange bg-orange/5"
              : "border-transparent text-muted-faro hover:text-ink hover:bg-surface"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{isHt ? "Règleman Kominote" : "Règles communautaires"}</span>
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-b-2 transition-all whitespace-nowrap ${
            activeTab === "audit"
              ? "border-orange text-orange bg-orange/5"
              : "border-transparent text-muted-faro hover:text-ink hover:bg-surface"
          }`}
        >
          <History className="w-4 h-4" />
          <span>{isHt ? "Jounal Odit" : "Journal d'audit"}</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: REPORTS QUEUE                                                      */}
      {/* ========================================================================= */}
      {activeTab === "reports" && (
        <div className="space-y-4">
          {/* Sub-filter pills */}
          <div className="flex gap-2 text-xs">
            {(["pending", "resolved", "dismissed", "all"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setReportFilter(st)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  reportFilter === st
                    ? "bg-ink text-surface font-semibold"
                    : "bg-surface border border-line text-muted-faro hover:text-ink"
                }`}
              >
                {st === "pending"
                  ? isHt ? "Ap tann egzamen" : "En attente"
                  : st === "resolved"
                  ? isHt ? "Rezoud" : "Traité"
                  : st === "dismissed"
                  ? isHt ? "Klase san swit" : "Classé sans suite"
                  : isHt ? "Tout" : "Tous"}
              </button>
            ))}
          </div>

          {filteredReports.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-line bg-surface p-12 text-center text-xs text-muted-faro space-y-2">
              <CheckCircle2 className="w-8 h-8 text-ok mx-auto" />
              <p className="font-heading font-semibold text-ink text-sm">
                {isHt ? "Okenn siyalman nan estati sa a !" : "Aucun signalement dans cet état !"}
              </p>
              <p>{isHt ? "Tout bagay pwòp nan kominote a." : "La communauté est sereine et respectueuse."}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReports.map((report) => (
                <div
                  key={report.id}
                  className="rounded-[18px] border border-line bg-surface p-5 sm:p-6 shadow-card space-y-4 transition-all"
                >
                  {/* Top info */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-tint text-red border border-red/20">
                        {isHt ? "Siyalman" : "Signalement"}
                      </span>
                      <span className="text-xs text-muted-faro">
                        {isHt ? "Siyale pa :" : "Signalé par :"} <strong className="text-ink">{report.reporterName}</strong>
                      </span>
                      <span className="text-xs text-muted-faro">•</span>
                      <span className="text-xs text-muted-faro">
                        {new Date(report.createdAt).toLocaleString(isHt ? "ht-HT" : "fr-FR")}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          report.status === "pending"
                            ? "bg-orange-tint text-orange border-orange/20"
                            : report.status === "resolved"
                            ? "bg-ok-tint text-ok border-ok/20"
                            : "bg-line text-muted-faro border-line"
                        }`}
                      >
                        {report.status === "pending"
                          ? "En attente"
                          : report.status === "resolved"
                          ? "Traité"
                          : "Classé sans suite"}
                      </span>
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="p-3 rounded-xl bg-red-tint/40 border border-red/20 text-xs text-ink flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red shrink-0 mt-0.5" />
                    <div>
                      <p className="font-heading font-semibold text-red">
                        {isHt ? "Rezon siyalman :" : "Motif invoqué :"}
                      </p>
                      <p className="text-muted-faro mt-0.5">{report.reason}</p>
                    </div>
                  </div>

                  {/* Reported message in context */}
                  <div className="p-4 rounded-xl border border-line bg-bg space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-bold text-ink">{report.authorName}</span>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-surface border border-line text-muted-faro">
                          {report.authorRole}
                        </span>
                        {report.messageDeleted && (
                          <span className="text-[10px] font-bold text-red bg-red-tint px-2 py-0.5 rounded">
                            [Supprimé]
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-faro font-mono">
                        {new Date(report.messageCreatedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className={`text-xs leading-relaxed ${report.messageDeleted ? "text-muted-faro italic line-through" : "text-ink"}`}>
                      {report.messageBody}
                    </p>
                  </div>

                  {/* Actions bar */}
                  {report.status === "pending" && (
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-line">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Delete message */}
                        {!report.messageDeleted && (
                          <button
                            onClick={() => handleDeleteMessage(report.id, report.messageId)}
                            disabled={isPending}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-tint hover:bg-red/20 text-red border border-red/30 text-xs font-heading font-semibold transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{isHt ? "Efase mesaj" : "Supprimer le message"}</span>
                          </button>
                        )}

                        {/* Mute buttons */}
                        <div className="inline-flex rounded-xl border border-line bg-surface p-0.5 text-xs">
                          <span className="px-2 py-1 text-muted-faro font-semibold flex items-center gap-1 border-r border-line text-[11px]">
                            <VolumeX className="w-3 h-3 text-orange" />
                            {isHt ? "Silans :" : "Mute :"}
                          </span>
                          <button
                            onClick={() => handleMuteAuthor(report.id, report.authorId, "1h")}
                            disabled={isPending}
                            className="px-2 py-1 rounded-lg hover:bg-bg text-ink text-[11px] font-medium"
                          >
                            1h
                          </button>
                          <button
                            onClick={() => handleMuteAuthor(report.id, report.authorId, "24h")}
                            disabled={isPending}
                            className="px-2 py-1 rounded-lg hover:bg-bg text-ink text-[11px] font-medium"
                          >
                            24h
                          </button>
                          <button
                            onClick={() => handleMuteAuthor(report.id, report.authorId, "7d")}
                            disabled={isPending}
                            className="px-2 py-1 rounded-lg hover:bg-bg text-ink text-[11px] font-medium"
                          >
                            7j
                          </button>
                        </div>

                        {/* Ban */}
                        <button
                          onClick={() => handleBanAuthor(report.id, report.authorId)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red/30 text-red hover:bg-red-tint text-xs font-heading font-semibold transition-colors"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>{isHt ? "Bani otè a" : "Bannir l'auteur"}</span>
                        </button>
                      </div>

                      <button
                        onClick={() => handleDismissReport(report.id)}
                        disabled={isPending}
                        className="px-3 py-1.5 rounded-xl border border-line text-muted-faro hover:text-ink hover:bg-bg text-xs font-semibold transition-colors"
                      >
                        {isHt ? "Klase san swit" : "Classer sans suite"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: AUTOMATIC MODERATION FLAGS (PHONE & OFF-PLATFORM DETECTION)          */}
      {/* ========================================================================= */}
      {activeTab === "flags" && (
        <div className="space-y-4">
          {/* Sub-filter pills */}
          <div className="flex gap-2 text-xs">
            {(["open", "reviewed", "dismissed", "all"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFlagFilter(st)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  flagFilter === st
                    ? "bg-ink text-surface font-semibold"
                    : "bg-surface border border-line text-muted-faro hover:text-ink"
                }`}
              >
                {st === "open"
                  ? isHt ? "Pou trete" : "À traiter"
                  : st === "reviewed"
                  ? isHt ? "Trete" : "Traité"
                  : st === "dismissed"
                  ? isHt ? "Inyore" : "Ignoré"
                  : isHt ? "Tout" : "Tous"}
              </button>
            ))}
          </div>

          {filteredFlags.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-line bg-surface p-12 text-center text-xs text-muted-faro space-y-2">
              <CheckCircle2 className="w-8 h-8 text-ok mx-auto" />
              <p className="font-heading font-semibold text-ink text-sm">
                {isHt
                  ? "Okenn drapo otomatik nan estati sa a !"
                  : "Aucun signalement automatique dans cet état !"}
              </p>
              <p>
                {isHt
                  ? "Sistèm deteksyon otomatik nimewo telefòn ak WhatsApp pa detekte tantativ sispèk."
                  : "Le moteur de détection n'a relevé aucune infraction en attente."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredFlags.map((flag) => (
                <div
                  key={flag.id}
                  className="rounded-[18px] border border-line bg-surface p-5 sm:p-6 shadow-card space-y-4 transition-all"
                >
                  {/* Top info */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-line pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-tint text-red border border-red/20">
                        {flag.reason === "phone"
                          ? isHt ? "Nimewo Telefòn" : "Numéro de téléphone"
                          : flag.reason === "offplatform"
                          ? isHt ? "WhatsApp / Hors-plateforme" : "WhatsApp / Hors-plateforme"
                          : isHt ? "Telefòn & WhatsApp" : "Téléphone & WhatsApp"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-line text-ink">
                        {flag.channelId === "community" ? "Communauté" : "Message privé"}
                      </span>
                      <span className="text-xs text-muted-faro">•</span>
                      <span className="text-xs text-muted-faro">
                        {new Date(flag.createdAt).toLocaleString(isHt ? "ht-HT" : "fr-FR")}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          flag.status === "open"
                            ? "bg-orange-tint text-orange border-orange/20"
                            : flag.status === "reviewed"
                            ? "bg-ok-tint text-ok border-ok/20"
                            : "bg-line text-muted-faro border-line"
                        }`}
                      >
                        {flag.status === "open"
                          ? isHt ? "Ap tann egzamen" : "En attente"
                          : flag.status === "reviewed"
                          ? isHt ? "Trete" : "Traité"
                          : isHt ? "Inyore" : "Ignoré"}
                      </span>
                    </div>
                  </div>

                  {/* User info */}
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="text-muted-faro">{isHt ? "Otè :" : "Auteur :"} </span>
                      <span className="font-heading font-bold text-ink">{flag.userName || "Utilisateur"}</span>
                      {flag.userEmail && (
                        <span className="text-muted-faro text-[11px] ml-2">({flag.userEmail})</span>
                      )}
                    </div>
                  </div>

                  {/* Masked excerpt */}
                  <div className="rounded-xl border border-line bg-bg p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-muted-faro">
                      <span className="font-medium text-ink flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-orange" />
                        {isHt ? "Ekstrè bloke (Masqué) :" : "Extrait intercepté (Masqué) :"}
                      </span>
                      <span className="text-[10px] text-muted-faro">
                        Numéro masqué pour la confidentialité
                      </span>
                    </div>
                    <p className="font-mono text-xs text-ink bg-surface border border-line/50 p-2.5 rounded-lg whitespace-pre-wrap break-words">
                      {flag.excerpt}
                    </p>
                  </div>

                  {/* Actions */}
                  {flag.status === "open" && (
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-line">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Review / Mark done */}
                        <button
                          onClick={() => handleReviewFlag(flag.id, "reviewed")}
                          disabled={isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ok-tint hover:bg-ok/20 text-ok border border-ok/30 text-xs font-heading font-semibold transition-colors disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isHt ? "Make kòm trete" : "Marquer comme traité"}</span>
                        </button>

                        {/* Mute user 24h */}
                        <button
                          onClick={() => handleMuteFromFlag(flag.id, flag.userId)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-orange/30 text-orange hover:bg-orange-tint text-xs font-heading font-semibold transition-colors disabled:opacity-50"
                        >
                          <VolumeX className="w-3.5 h-3.5" />
                          <span>{isHt ? "Mete an silans 24h" : "Sourdine 24h"}</span>
                        </button>
                      </div>

                      {/* Dismiss */}
                      <button
                        onClick={() => handleReviewFlag(flag.id, "dismissed")}
                        disabled={isPending}
                        className="px-3 py-1.5 rounded-xl border border-line text-muted-faro hover:text-ink hover:bg-bg text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        {isHt ? "Inyore" : "Ignorer"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MUTED & BANNED USERS LIST (WITH 1-CLICK UNDO & AUTO EXPIRY)         */}
      {/* ========================================================================= */}
      {activeTab === "sanctions" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Muted Users */}
          <div className="rounded-[18px] border border-line bg-surface p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-heading font-bold text-ink flex items-center gap-2">
                <VolumeX className="w-4 h-4 text-orange" />
                <span>{isHt ? "Itilizatè an Silans (Muted)" : "Membres en sourdine (Mute)"}</span>
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-tint text-orange border border-orange/20">
                {mutedUsers.length}
              </span>
            </div>

            <p className="text-xs text-muted-faro">
              {isHt
                ? "Silans lan ekspire otomatikman lè tan an rive. Ou ka anile l tou nenpòt kilè an 1 klik."
                : "La mise en sourdine expire automatiquement à l'échéance. Vous pouvez également la lever manuellement en 1 clic."}
            </p>

            <div className="space-y-2">
              {mutedUsers.length === 0 ? (
                <p className="text-xs text-muted-faro italic p-4 text-center border border-dashed border-line rounded-xl">
                  {isHt ? "Pa gen okenn manm an silans kounye a." : "Aucun membre en sourdine actuellement."}
                </p>
              ) : (
                mutedUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-line bg-bg text-xs"
                  >
                    <div className="space-y-0.5">
                      <p className="font-heading font-bold text-ink">{u.name}</p>
                      <p className="text-[11px] text-muted-faro">
                        {u.isExpired ? (
                          <span className="text-muted-faro">Expiré automatiquement</span>
                        ) : (
                          <span className="text-orange font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Jusqu&apos;au : {new Date(u.mutedUntil).toLocaleString()}
                          </span>
                        )}
                      </p>
                    </div>

                    <button
                      onClick={() => handleUnmute(u.id)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-line bg-surface text-ink hover:bg-bg transition-colors font-semibold text-xs shadow-sm"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-ok" />
                      <span>{isHt ? "Leve silans" : "Démuter"}</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Banned Users */}
          <div className="rounded-[18px] border border-line bg-surface p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-heading font-bold text-ink flex items-center gap-2">
                <UserX className="w-4 h-4 text-red" />
                <span>{isHt ? "Itilizatè Bani (Banned)" : "Utilisateurs bannis (Banned)"}</span>
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-tint text-red border border-red/20">
                {bannedUsers.length}
              </span>
            </div>

            <p className="text-xs text-muted-faro">
              {isHt
                ? "Itilizatè sa yo bloke sou tout platfòm nan. Ou ka retabli yo si sa nesesè an 1 klik."
                : "Ces utilisateurs ont un accès totalement bloqué au niveau du serveur. Vous pouvez réactiver leur compte en 1 clic."}
            </p>

            <div className="space-y-2">
              {bannedUsers.length === 0 ? (
                <p className="text-xs text-muted-faro italic p-4 text-center border border-dashed border-line rounded-xl">
                  {isHt ? "Pa gen okenn itilizatè ki bani." : "Aucun utilisateur banni actuellement."}
                </p>
              ) : (
                bannedUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-line bg-bg text-xs"
                  >
                    <div className="space-y-0.5">
                      <p className="font-heading font-bold text-ink">{u.name}</p>
                      <p className="text-[11px] text-muted-faro">{u.email}</p>
                    </div>

                    <button
                      onClick={() => handleUnban(u.id)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-line bg-surface text-ink hover:bg-bg transition-colors font-semibold text-xs shadow-sm"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-ok" />
                      <span>{isHt ? "Retabli kont" : "Réactiver"}</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: WORD FILTER (FR & KR)                                              */}
      {/* ========================================================================= */}
      {activeTab === "filters" && (
        <div className="rounded-[18px] border border-line bg-surface p-6 shadow-card space-y-6">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div>
              <h2 className="text-sm font-heading font-bold text-ink flex items-center gap-2">
                <Filter className="w-4 h-4 text-orange" />
                <span>{isHt ? "Filtè Mo Entèdi (Français & Kreyòl)" : "Filtre de mots bloqués (FR & KR)"}</span>
              </h2>
              <p className="text-xs text-muted-faro mt-0.5">
                {isHt
                  ? "Mesaj ki gen mo sa yo bloke imedyatman anvan yo pibliye nan kominote a."
                  : "Les messages contenant ces mots sont automatiquement rejetés lors de l'envoi."}
              </p>
            </div>

            <button
              onClick={handleSaveWordFilters}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange hover:bg-orange-strong text-white text-xs font-heading font-semibold shadow-orange transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isHt ? "Anrejistre" : "Enregistrer"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* French terms */}
            <div className="space-y-3">
              <label className="text-xs font-heading font-bold text-ink">
                Français ({wordFilters.fr.length} termes)
              </label>
              <div className="p-3 rounded-xl border border-line bg-bg min-h-[140px] flex flex-wrap gap-1.5 content-start">
                {wordFilters.fr.map((w) => (
                  <span
                    key={w}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface border border-line text-ink text-[11px]"
                  >
                    <span>{w}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveWord("fr", w)}
                      className="text-muted-faro hover:text-red ml-0.5"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ajouter un mot ou motif en français..."
                  value={newFrWord}
                  onChange={(e) => setNewFrWord(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddWord("fr")}
                  className="flex-1 rounded-xl border border-line bg-bg p-2 text-xs text-ink focus:outline-none focus:border-orange"
                />
                <button
                  type="button"
                  onClick={() => handleAddWord("fr")}
                  className="px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-semibold hover:bg-bg"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Creole terms */}
            <div className="space-y-3">
              <label className="text-xs font-heading font-bold text-ink">
                Kreyòl Ayisyen ({wordFilters.ht.length} tèm)
              </label>
              <div className="p-3 rounded-xl border border-line bg-bg min-h-[140px] flex flex-wrap gap-1.5 content-start">
                {wordFilters.ht.map((w) => (
                  <span
                    key={w}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface border border-line text-ink text-[11px]"
                  >
                    <span>{w}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveWord("ht", w)}
                      className="text-muted-faro hover:text-red ml-0.5"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ajoute yon mo oswa fraz an kreyòl..."
                  value={newHtWord}
                  onChange={(e) => setNewHtWord(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddWord("ht")}
                  className="flex-1 rounded-xl border border-line bg-bg p-2 text-xs text-ink focus:outline-none focus:border-orange"
                />
                <button
                  type="button"
                  onClick={() => handleAddWord("ht")}
                  className="px-3 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-semibold hover:bg-bg"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: COMMUNITY RULES (FR & KR)                                          */}
      {/* ========================================================================= */}
      {activeTab === "rules" && (
        <div className="rounded-[18px] border border-line bg-surface p-6 shadow-card space-y-6">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div>
              <h2 className="text-sm font-heading font-bold text-ink flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange" />
                <span>{isHt ? "Règleman Kominote a (FR & KR)" : "Règles de la communauté (FR & KR)"}</span>
              </h2>
              <p className="text-xs text-muted-faro mt-0.5">
                {isHt
                  ? "Tèks sa a parèt nan fenèt règleman obligatwa a lè yon aprann rantre premye fwa."
                  : "Ce texte est affiché dans la fenêtre modale obligatoire lors de la première visite de chaque apprenant."}
              </p>
            </div>

            <button
              onClick={handleSaveRules}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange hover:bg-orange-strong text-white text-xs font-heading font-semibold shadow-orange transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isHt ? "Anrejistre" : "Enregistrer"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-heading font-bold text-ink">Version Française (FR)</label>
              <textarea
                rows={12}
                value={rules.fr}
                onChange={(e) => setRules({ ...rules, fr: e.target.value })}
                className="w-full rounded-xl border border-line bg-bg p-3 text-xs text-ink font-mono leading-relaxed focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange/30"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-heading font-bold text-ink">Vèsyon Kreyòl (KR)</label>
              <textarea
                rows={12}
                value={rules.ht}
                onChange={(e) => setRules({ ...rules, ht: e.target.value })}
                className="w-full rounded-xl border border-line bg-bg p-3 text-xs text-ink font-mono leading-relaxed focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange/30"
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: AUDIT LOGS                                                         */}
      {/* ========================================================================= */}
      {activeTab === "audit" && (
        <div className="rounded-[18px] border border-line bg-surface p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h2 className="text-sm font-heading font-bold text-ink flex items-center gap-2">
              <History className="w-4 h-4 text-orange" />
              <span>{isHt ? "Jounal Tout Aksyon Moderasyon" : "Journal d'audit des actions de modération"}</span>
            </h2>
            <span className="text-xs text-muted-faro">{auditLogs.length} entrées</span>
          </div>

          <div className="divide-y divide-line/60">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-muted-faro italic py-6 text-center">Aucune action enregistrée pour le moment.</p>
            ) : (
              auditLogs.map((log: any) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                  <div className="space-y-0.5">
                    <p className="font-heading font-semibold text-ink">
                      Action : <code className="text-orange font-mono text-[11px] bg-orange-tint px-1.5 py-0.5 rounded">{log.action}</code>
                    </p>
                    <p className="text-[11px] text-muted-faro">{log.reason || "Motif non précisé"}</p>
                  </div>
                  <span className="text-[10px] text-muted-faro shrink-0 font-mono">
                    {new Date(log.createdAt).toLocaleString(isHt ? "ht-HT" : "fr-FR")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
