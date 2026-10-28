"use client";

import { useState, useTransition } from "react";
import {
  MessageSquare,
  Sparkles,
  ShieldAlert,
  Power,
  Sliders,
  DollarSign,
  TrendingUp,
  Clock,
  AlertTriangle,
  Lock,
  Unlock,
  Eye,
  Plus,
  Send,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
} from "lucide-react";
import {
  toggleAiKillSwitchAction,
  saveGlobalAiConfigAction,
  unlockPrivateConversationBreakGlassAction,
  adminStartStudentConversationAction,
} from "@/app/actions/admin-supervision";
import type {
  MessagingSupervisionStats,
  GlobalAiSettings,
  BreakGlassAccessLog,
} from "@/lib/admin/messaging-supervision";
import type { Conversation, PrivateMessage } from "@/lib/messaging/types";
import type { StudentItem } from "@/lib/admin/student-types";

interface AdminMessagingSupervisionClientProps {
  initialStats: MessagingSupervisionStats;
  initialSettings: GlobalAiSettings;
  conversations: Conversation[];
  students: StudentItem[];
  breakGlassLogs: BreakGlassAccessLog[];
  currentAdminId: string;
  locale: string;
}

export function AdminMessagingSupervisionClient({
  initialStats,
  initialSettings,
  conversations: initialConvs,
  students,
  breakGlassLogs: initialLogs,
  currentAdminId,
  locale,
}: AdminMessagingSupervisionClientProps) {
  const [stats, setStats] = useState<MessagingSupervisionStats>(initialStats);
  const [settings, setSettings] = useState<GlobalAiSettings>(initialSettings);
  const [conversations] = useState<Conversation[]>(initialConvs);
  const [breakGlassLogs, setBreakGlassLogs] = useState<BreakGlassAccessLog[]>(initialLogs);

  // Break-glass modal state
  const [breakGlassTarget, setBreakGlassTarget] = useState<Conversation | null>(null);
  const [breakGlassContext, setBreakGlassContext] = useState<"report" | "escalation">("escalation");
  const [breakGlassReason, setBreakGlassReason] = useState("");
  const [breakGlassError, setBreakGlassError] = useState<string | null>(null);

  // Unlocked conversation inspection drawer/modal
  const [inspectedConversation, setInspectedConversation] = useState<{
    conversation: Conversation;
    messages: PrivateMessage[];
  } | null>(null);

  // Admin New Student Conversation Modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [targetStudentId, setTargetStudentId] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newError, setNewError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"conversations" | "ai_settings" | "audit">("conversations");
  const [isPending, startTransition] = useTransition();
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const isHt = locale === "ht";

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Toggle Kill Switch
  const handleToggleKillSwitch = () => {
    const nextState = !settings.killSwitch;
    setSettings((s) => ({ ...s, killSwitch: nextState }));

    startTransition(async () => {
      const res = await toggleAiKillSwitchAction(nextState);
      if (res.success) {
        showNotification(
          nextState
            ? isHt
              ? "KILL SWITCH AKTIF : Asistan IA kanpe sou tout platfòm nan !"
              : "KILL SWITCH ACTIVÉ : L'IA est arrêtée sur l'ensemble de la plateforme !"
            : isHt
              ? "Asistan IA re-aktive sou platfòm nan !"
              : "Assistant IA réactivé sur la plateforme !",
          nextState ? "error" : "success"
        );
      } else {
        showNotification(res.error || "Erreur de mise à jour.", "error");
      }
    });
  };

  // Save Global AI Config
  const handleSaveConfig = () => {
    startTransition(async () => {
      const res = await saveGlobalAiConfigAction(settings);
      if (res.success) {
        showNotification(
          isHt ? "Paramèt jeneral IA yo anrejistre !" : "Configuration globale enregistrée !",
          "success"
        );
      } else {
        showNotification(res.error || "Erreur d'enregistrement.", "error");
      }
    });
  };

  // Break-glass unlock submit
  const handleBreakGlassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!breakGlassTarget) return;

    if (!breakGlassReason.trim() || breakGlassReason.trim().length < 10) {
      setBreakGlassError(
        isHt
          ? "Tanpri ekri yon rezon detaye (omwen 10 karaktè) pou jistifye aksè sa a."
          : "Veuillez fournir un motif écrit détaillé (au moins 10 caractères)."
      );
      return;
    }

    setBreakGlassError(null);
    startTransition(async () => {
      const res = await unlockPrivateConversationBreakGlassAction(
        breakGlassTarget.id,
        breakGlassContext,
        breakGlassReason
      );

      if (res.success && res.data) {
        const unlocked = res.data;
        setInspectedConversation(unlocked);
        setBreakGlassTarget(null);
        setBreakGlassReason("");
        setBreakGlassLogs((prev) => [
          {
            id: `bg-${Date.now()}`,
            adminId: currentAdminId,
            adminName: "Moi (Admin)",
            conversationId: unlocked.conversation.id,
            context: breakGlassContext,
            reason: breakGlassReason,
            accessedAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        showNotification(
          isHt ? "Aksè anrejistre nan jounal odit !" : "Accès consigné dans le journal d'audit !",
          "success"
        );
      } else {
        setBreakGlassError(res.error || "Erreur lors du déverrouillage.");
      }
    });
  };

  // Admin New Student Conversation submit
  const handleCreateStudentConv = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStudentId || !newSubject.trim() || !newMessage.trim()) {
      setNewError(isHt ? "Tanpri ranpli tout chan yo." : "Veuillez remplir tous les champs.");
      return;
    }

    setNewError(null);
    startTransition(async () => {
      const res = await adminStartStudentConversationAction(
        targetStudentId,
        newSubject,
        newMessage
      );
      if (res.success) {
        setIsNewModalOpen(false);
        setTargetStudentId("");
        setNewSubject("");
        setNewMessage("");
        showNotification(
          isHt ? "Mesaj la voye bay elèv la !" : "Discussion initiée avec l'étudiant !",
          "success"
        );
      } else {
        setNewError(res.error || "Erreur lors de l'envoi.");
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
            {isHt ? "Sipèvizyon Mesajri" : "Supervision de la messagerie"}
          </span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading font-bold text-2xl sm:text-[28px] text-ink flex items-center gap-2.5">
              <MessageSquare className="w-6 h-6 text-orange" />
              <span>{isHt ? "Sipèvizyon Mesajri & Paramèt IA" : "Supervision de la Messagerie & IA"}</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-faro">
              {isHt
                ? "Estatistik echanj, kontwòl jeneral asistan IA (Kill Switch), ak sipèvizyon sekirize konvèsasyon yo."
                : "Métriques des échanges, pilotage global de l'IA (Kill Switch) et supervision des discussions privées."}
            </p>
          </div>

          <button
            onClick={() => setIsNewModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange hover:bg-orange-strong text-white text-xs font-heading font-semibold shadow-orange transition-all shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>{isHt ? "Ekri yon elèv" : "Écrire à un élève"}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. MASTER AI KILL SWITCH BANNER                                           */}
      {/* ========================================================================= */}
      <div
        className={`rounded-[18px] border p-5 sm:p-6 transition-all shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          settings.killSwitch
            ? "bg-red-tint/60 border-red text-ink"
            : "bg-surface border-line"
        }`}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
              settings.killSwitch
                ? "bg-red text-white border-red shadow-lg"
                : "bg-ok-tint text-ok border-ok/30"
            }`}
          >
            <Power className="w-5 h-5" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="font-heading font-bold text-sm text-ink">
                {settings.killSwitch
                  ? isHt
                    ? "KILL SWITCH AKTIF : Asistan IA arête nèt"
                    : "KILL SWITCH ACTIF : Assistant IA coupé partout"
                  : isHt
                    ? "Asistan IA an fonksyonman nòmal"
                    : "Assistant IA opérationnel sur la plateforme"}
              </h2>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  settings.killSwitch
                    ? "bg-red text-white"
                    : "bg-ok-tint text-ok border border-ok/30"
                }`}
              >
                {settings.killSwitch ? "Arret d'urgence" : "En service"}
              </span>
            </div>

            <p className="text-xs text-muted-faro max-w-2xl leading-relaxed">
              {settings.killSwitch
                ? isHt
                  ? "Tout repons otomatik IA yo bloke imedyatman. Lè yon elèv poze yon kesyon, li transfere dirèkteman bay fòmatè a pa imèl (pwosesis eskalasyon an kontinye fonksyone nòmalman san IA)."
                  : "Toutes les réponses de l'IA sont immédiatement neutralisées. Les questions des étudiants sont acheminées directement aux formateurs par e-mail sans réponse automatique."
                : isHt
                  ? "Asistan IA a reponn elèv yo lè fòmatè yo pa an liy, epi li fè eskalasyon lè sa nesesè."
                  : "L'assistant IA répond automatiquement aux étudiants quand les formateurs sont hors-ligne et escalade en cas de besoin."}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggleKillSwitch}
          disabled={isPending}
          className={`px-4 py-2.5 rounded-xl font-heading font-semibold text-xs transition-all shrink-0 shadow-sm ${
            settings.killSwitch
              ? "bg-ink text-surface hover:opacity-90"
              : "bg-red hover:bg-red/90 text-white"
          }`}
        >
          {settings.killSwitch
            ? isHt
              ? "Dezaktive Kill Switch la"
              : "Désactiver le Kill Switch"
            : isHt
              ? "Koupe tout IA a (Kill Switch)"
              : "Activer le Kill Switch d'urgence"}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 2. SUPERVISION STATISTICS KPIS                                            */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Median Response Time */}
        <div className="rounded-[18px] border border-line bg-surface p-4 sm:p-5 shadow-card space-y-1">
          <p className="text-[11px] font-heading font-semibold text-muted-faro uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-orange" />
            <span>{isHt ? "Tan repons fòmatè" : "Délai médian formateur"}</span>
          </p>
          <p className="text-2xl font-heading font-bold text-ink">
            {stats.medianResponseTimeMinutes} <span className="text-xs font-normal text-muted-faro">min</span>
          </p>
        </div>

        {/* AI Resolution Rate */}
        <div className="rounded-[18px] border border-line bg-surface p-4 sm:p-5 shadow-card space-y-1">
          <p className="text-[11px] font-heading font-semibold text-muted-faro uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue" />
            <span>{isHt ? "Rezolisyon pa IA" : "Résolu par l'IA"}</span>
          </p>
          <p className="text-2xl font-heading font-bold text-ink">{stats.aiResolutionRatePercent}%</p>
        </div>

        {/* Escalations Count */}
        <div className="rounded-[18px] border border-line bg-surface p-4 sm:p-5 shadow-card space-y-1">
          <p className="text-[11px] font-heading font-semibold text-muted-faro uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-orange" />
            <span>{isHt ? "Eskalasyon voye" : "Escalades formateurs"}</span>
          </p>
          <p className="text-2xl font-heading font-bold text-ink">{stats.escalationsCount}</p>
        </div>

        {/* Reviens plus tard cases */}
        <div className="rounded-[18px] border border-line bg-surface p-4 sm:p-5 shadow-card space-y-1">
          <p className="text-[11px] font-heading font-semibold text-muted-faro uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-muted-faro" />
            <span>&quot;Reviens plus tard&quot;</span>
          </p>
          <p className="text-2xl font-heading font-bold text-ink">{stats.reviensPlusTardCount}</p>
        </div>

        {/* Estimated AI Cost per day */}
        <div className="col-span-2 lg:col-span-1 rounded-[18px] border border-line bg-surface p-4 sm:p-5 shadow-card space-y-1">
          <p className="text-[11px] font-heading font-semibold text-muted-faro uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-ok" />
            <span>{isHt ? "Kou IA / jou" : "Coût IA estimé / jour"}</span>
          </p>
          <p className="text-2xl font-heading font-bold text-ink">${stats.aiCostPerDayUsd}</p>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-line gap-2 pb-1 text-xs font-heading font-semibold">
        <button
          onClick={() => setActiveTab("conversations")}
          className={`px-4 py-2 rounded-xl border-b-2 transition-all ${
            activeTab === "conversations"
              ? "border-orange text-orange bg-orange/5"
              : "border-transparent text-muted-faro hover:text-ink hover:bg-surface"
          }`}
        >
          {isHt ? "Tout Diskisyon yo" : "Toutes les discussions"} ({conversations.length})
        </button>

        <button
          onClick={() => setActiveTab("ai_settings")}
          className={`px-4 py-2 rounded-xl border-b-2 transition-all ${
            activeTab === "ai_settings"
              ? "border-orange text-orange bg-orange/5"
              : "border-transparent text-muted-faro hover:text-ink hover:bg-surface"
          }`}
        >
          {isHt ? "Paramèt Jeneral IA" : "Paramètres IA globaux"}
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={`px-4 py-2 rounded-xl border-b-2 transition-all ${
            activeTab === "audit"
              ? "border-orange text-orange bg-orange/5"
              : "border-transparent text-muted-faro hover:text-ink hover:bg-surface"
          }`}
        >
          {isHt ? "Odit Aksè Superviseur" : "Journal d'accès superviseur (Break-glass)"} ({breakGlassLogs.length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ALL CONVERSATIONS LIST (SUPERVISOR BREAK-GLASS)                    */}
      {/* ========================================================================= */}
      {activeTab === "conversations" && (
        <div className="rounded-[18px] border border-line bg-surface shadow-card overflow-hidden">
          <div className="p-4 border-b border-line bg-surface flex items-center justify-between">
            <div className="text-xs text-muted-faro">
              {isHt
                ? "Klike sou yon konvèsasyon pou enspekte l. Si se yon diskisyon ant yon fòmatè ak yon elèv, yon jistifikasyon ekri obligatwa."
                : "Consultez l'ensemble des discussions. L'accès à une discussion privée d'un formateur nécessite une justification (consignée à l'audit)."}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-bg/50 text-muted-faro font-heading font-semibold">
                <tr>
                  <th scope="col" className="px-5 py-3.5">Élève</th>
                  <th scope="col" className="px-5 py-3.5">Intervenant</th>
                  <th scope="col" className="px-5 py-3.5">Formation / Sujet</th>
                  <th scope="col" className="px-5 py-3.5">Statut</th>
                  <th scope="col" className="px-5 py-3.5">Dernier échange</th>
                  <th scope="col" className="px-5 py-3.5 text-right">Supervision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {conversations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-muted-faro">
                      Aucune conversation enregistrée.
                    </td>
                  </tr>
                ) : (
                  conversations.map((conv) => {
                    const isOwnStaff = conv.staffId === currentAdminId;

                    return (
                      <tr key={conv.id} className="hover:bg-bg/40 transition-colors">
                        <td className="px-5 py-3.5 font-heading font-semibold text-ink">
                          {conv.studentName}
                        </td>
                        <td className="px-5 py-3.5 text-muted-faro">
                          <span className="font-medium text-ink">{conv.staffName}</span>
                          <span className="text-[10px] ml-1.5 uppercase font-bold text-muted-faro bg-bg px-1.5 py-0.5 rounded border border-line">
                            {conv.staffRole}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-ink truncate max-w-[200px]">{conv.subject}</p>
                          <p className="text-[11px] text-muted-faro truncate max-w-[200px]">{conv.courseTitle}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              conv.status === "open" || conv.status === "waiting_staff"
                                ? "bg-orange-tint text-orange border-orange/20"
                                : conv.status === "ai_handling"
                                ? "bg-blue-tint text-blue border-blue/20"
                                : conv.status === "staff_replied"
                                ? "bg-ok-tint text-ok border-ok/20"
                                : "bg-line text-muted-faro border-line"
                            }`}
                          >
                            {conv.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-muted-faro text-[11px]">
                          {new Date(conv.lastMessageAt).toLocaleString(isHt ? "ht-HT" : "fr-FR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => {
                              if (isOwnStaff) {
                                // Direct access for own conversations
                                unlockPrivateConversationBreakGlassAction(
                                  conv.id,
                                  "escalation",
                                  "Consultation par l'administrateur participant"
                                ).then((res) => {
                                  if (res.data) setInspectedConversation(res.data);
                                });
                              } else {
                                // Break-glass required
                                setBreakGlassTarget(conv);
                              }
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-semibold transition-colors shadow-sm ${
                              isOwnStaff
                                ? "bg-surface border border-line hover:bg-bg text-ink"
                                : "bg-orange-tint border border-orange/30 text-orange hover:bg-orange/20"
                            }`}
                          >
                            {isOwnStaff ? (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                <span>Consulter</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5" />
                                <span>Inspections (Odit)</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GLOBAL AI SETTINGS FORM                                            */}
      {/* ========================================================================= */}
      {activeTab === "ai_settings" && (
        <div className="rounded-[18px] border border-line bg-surface p-6 shadow-card space-y-6 max-w-3xl">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div>
              <h2 className="text-sm font-heading font-bold text-ink flex items-center gap-2">
                <Sliders className="w-4 h-4 text-orange" />
                <span>{isHt ? "Konfigirasyon Jeneral Asistan IA" : "Paramètres IA globaux de la plateforme"}</span>
              </h2>
              <p className="text-xs text-muted-faro mt-0.5">
                {isHt
                  ? "Aplike sou tout asistan fòmatè yo pou kontwole modèl, pri ak limit chak elèv."
                  : "Ces paramètres s'appliquent par défaut à tous les assistants pour contrôler les coûts et quotas."}
              </p>
            </div>

            <button
              onClick={handleSaveConfig}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange hover:bg-orange-strong text-white text-xs font-heading font-semibold shadow-orange transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isHt ? "Anrejistre" : "Enregistrer"}</span>
            </button>
          </div>

          <div className="space-y-4 text-xs">
            {/* Model Selection */}
            <div className="space-y-1">
              <label className="font-heading font-semibold text-ink">
                Modèle de fondation LLM par défaut
              </label>
              <select
                value={settings.defaultModel}
                onChange={(e) => setSettings({ ...settings, defaultModel: e.target.value })}
                className="w-full rounded-xl border border-line bg-bg p-2.5 text-ink focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange/30 font-mono text-xs"
              >
                <option value="claude-3-haiku-20240307">Claude 3 Haiku (Rapide, économique, idéal pour le mobile)</option>
                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Raisonnement avancé, plus coûteux)</option>
              </select>
            </div>

            {/* Confidence Threshold */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-heading font-semibold text-ink">
                  Seuil de certitude minimal global
                </label>
                <span className="font-mono font-bold text-orange">
                  {Math.round(settings.defaultConfidenceThreshold * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.50"
                max="0.95"
                step="0.05"
                value={settings.defaultConfidenceThreshold}
                onChange={(e) =>
                  setSettings({ ...settings, defaultConfidenceThreshold: parseFloat(e.target.value) })
                }
                className="w-full accent-orange cursor-pointer"
              />
            </div>

            {/* Daily cost cap */}
            <div className="space-y-1">
              <label className="font-heading font-semibold text-ink">
                Plafond budgétaire quotidien ($ USD)
              </label>
              <input
                type="number"
                min="0.5"
                max="100"
                step="0.5"
                value={settings.dailyCostCapUsd}
                onChange={(e) =>
                  setSettings({ ...settings, dailyCostCapUsd: parseFloat(e.target.value) || 5 })
                }
                className="w-full rounded-xl border border-line bg-bg p-2.5 text-ink focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange/30 font-mono"
              />
              <p className="text-[11px] text-muted-faro">
                Si ce budget journalier est atteint, les assistants basculent automatiquement en mode escalation sans coût additionnel.
              </p>
            </div>

            {/* Per-student limit */}
            <div className="space-y-1">
              <label className="font-heading font-semibold text-ink">
                Quota quotidien maximal par étudiant (réponses IA / jour)
              </label>
              <input
                type="number"
                min="5"
                max="100"
                value={settings.studentDailyLimit}
                onChange={(e) =>
                  setSettings({ ...settings, studentDailyLimit: parseInt(e.target.value) || 30 })
                }
                className="w-full rounded-xl border border-line bg-bg p-2.5 text-ink focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange/30 font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: BREAK-GLASS AUDIT LOGS                                             */}
      {/* ========================================================================= */}
      {activeTab === "audit" && (
        <div className="rounded-[18px] border border-line bg-surface p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h2 className="text-sm font-heading font-bold text-ink flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-orange" />
              <span>{isHt ? "Jounal Aksè Superviseur (Break-glass)" : "Journal d'accès superviseur exceptionnel"}</span>
            </h2>
            <span className="text-xs text-muted-faro">{breakGlassLogs.length} consultations</span>
          </div>

          <div className="divide-y divide-line/60">
            {breakGlassLogs.length === 0 ? (
              <p className="text-xs text-muted-faro italic py-6 text-center">
                Aucune inspection exceptionnelle enregistrée.
              </p>
            ) : (
              breakGlassLogs.map((log) => (
                <div key={log.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-ink">{log.adminName}</span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-orange-tint text-orange border border-orange/20">
                        {log.context === "report" ? "Signalement" : "Escalade"}
                      </span>
                      <span className="text-muted-faro font-mono text-[11px]">#{log.conversationId}</span>
                    </div>
                    <p className="text-muted-faro text-[11px]">&quot;{log.reason}&quot;</p>
                  </div>
                  <span className="text-[10px] text-muted-faro font-mono shrink-0">
                    {new Date(log.accessedAt).toLocaleString(isHt ? "ht-HT" : "fr-FR")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BREAK-GLASS CONFIRMATION                                           */}
      {/* ========================================================================= */}
      {breakGlassTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="breakglass-title"
            className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl animate-in zoom-in-95 duration-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 id="breakglass-title" className="font-heading font-bold text-base text-ink flex items-center gap-2">
                <Lock className="w-5 h-5 text-orange" />
                <span>Accès Superviseur Restreint</span>
              </h3>
              <button
                onClick={() => setBreakGlassTarget(null)}
                className="p-1 rounded-lg text-muted-faro hover:text-ink hover:bg-bg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-orange-tint/60 border border-orange/20 text-xs text-ink space-y-1">
              <p className="font-heading font-semibold text-orange-strong">
                Garantie de Confidentialité de la Plateforme (P14)
              </p>
              <p className="text-[11px] text-muted-faro leading-relaxed">
                La consultation d&apos;une discussion privée entre un formateur et un apprenant est strictement encadrée. Elle est permise uniquement lors d&apos;un signalement ou d&apos;une escalade urgente, et l&apos;accès est irrévocablement consigné au journal d&apos;audit.
              </p>
            </div>

            {breakGlassError && (
              <div className="p-2.5 rounded-xl bg-red-tint border border-red/20 text-red text-xs">
                {breakGlassError}
              </div>
            )}

            <form onSubmit={handleBreakGlassSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-heading font-semibold text-ink">Contexte légitime d&apos;accès *</label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                      breakGlassContext === "escalation"
                        ? "border-orange bg-orange/5 font-semibold text-orange"
                        : "border-line bg-bg text-muted-faro"
                    }`}
                  >
                    <input
                      type="radio"
                      name="context"
                      value="escalation"
                      checked={breakGlassContext === "escalation"}
                      onChange={() => setBreakGlassContext("escalation")}
                      className="text-orange focus:ring-orange"
                    />
                    <span>Escalade non résolue</span>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                      breakGlassContext === "report"
                        ? "border-orange bg-orange/5 font-semibold text-orange"
                        : "border-line bg-bg text-muted-faro"
                    }`}
                  >
                    <input
                      type="radio"
                      name="context"
                      value="report"
                      checked={breakGlassContext === "report"}
                      onChange={() => setBreakGlassContext("report")}
                      className="text-orange focus:ring-orange"
                    />
                    <span>Signalement d&apos;abus</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-heading font-semibold text-ink">
                  Justification administrative écrite (obligatoire) *
                </label>
                <textarea
                  rows={3}
                  value={breakGlassReason}
                  onChange={(e) => setBreakGlassReason(e.target.value)}
                  placeholder="Ex: Demande d'intervention suite au dépassement du délai de 2 minutes par le formateur..."
                  className="w-full rounded-xl border border-line bg-bg p-3 text-xs text-ink focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange/30"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setBreakGlassTarget(null)}
                  className="px-4 py-2 rounded-xl border border-line text-ink hover:bg-bg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-orange hover:bg-orange-strong text-white font-heading font-semibold shadow-orange transition-all disabled:opacity-50"
                >
                  {isPending ? "Déverrouillage..." : "Déverrouiller et consigner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAWER / MODAL: INSPECTED CONVERSATION THREAD                             */}
      {/* ========================================================================= */}
      {inspectedConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-ink/60 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            className="h-full w-full max-w-xl border-l border-line bg-surface p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200"
          >
            <div>
              <div className="flex items-start justify-between border-b border-line pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-orange-tint text-orange border border-orange/20">
                      Supervision active
                    </span>
                    <h3 className="font-heading font-bold text-sm text-ink">
                      {inspectedConversation.conversation.studentName} & {inspectedConversation.conversation.staffName}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-faro mt-0.5">
                    {inspectedConversation.conversation.subject} • {inspectedConversation.conversation.courseTitle}
                  </p>
                </div>
                <button
                  onClick={() => setInspectedConversation(null)}
                  className="p-1.5 rounded-lg text-muted-faro hover:text-ink hover:bg-bg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Messages list */}
              <div className="py-4 space-y-3">
                {inspectedConversation.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-xl border text-xs space-y-1 ${
                      m.senderType === "ai"
                        ? "bg-blue-tint/50 border-blue/20"
                        : m.senderType === "staff"
                        ? "bg-chat-bubble-own border-ok/20"
                        : "bg-bg border-line"
                    }`}
                  >
                    <div className="flex items-center justify-between font-heading font-semibold text-[11px]">
                      <span>{m.senderName || m.senderType}</span>
                      <span className="text-muted-faro text-[10px] font-mono">
                        {new Date(m.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-line text-right">
              <button
                onClick={() => setInspectedConversation(null)}
                className="px-4 py-2 rounded-xl border border-line text-ink hover:bg-bg text-xs font-semibold"
              >
                Fermer l&apos;inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADMIN DIRECT MESSAGE TO STUDENT                                    */}
      {/* ========================================================================= */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl animate-in zoom-in-95 duration-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-heading font-bold text-base text-ink flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-orange" />
                <span>Initier une discussion directe avec un étudiant</span>
              </h3>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-1 text-muted-faro hover:text-ink rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {newError && (
              <div className="p-2.5 rounded-xl bg-red-tint border border-red/20 text-red text-xs">
                {newError}
              </div>
            )}

            <form onSubmit={handleCreateStudentConv} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-heading font-semibold text-ink">Destinataire (Élève) *</label>
                <select
                  value={targetStudentId}
                  onChange={(e) => setTargetStudentId(e.target.value)}
                  className="w-full rounded-xl border border-line bg-bg p-2.5 text-ink focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange/30"
                >
                  <option value="">-- Choisir un apprenant --</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-heading font-semibold text-ink">Sujet de l&apos;échange *</label>
                <input
                  type="text"
                  placeholder="Ex: Information importante concernant votre formation..."
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full rounded-xl border border-line bg-bg p-2.5 text-ink focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange/30"
                />
              </div>

              <div className="space-y-1">
                <label className="font-heading font-semibold text-ink">Votre message *</label>
                <textarea
                  rows={4}
                  placeholder="Écrivez votre message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="w-full rounded-xl border border-line bg-bg p-2.5 text-ink focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange/30"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-line text-ink hover:bg-bg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-orange hover:bg-orange-strong text-white font-heading font-semibold shadow-orange transition-all disabled:opacity-50"
                >
                  {isPending ? "Envoi..." : "Envoyer le message"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
