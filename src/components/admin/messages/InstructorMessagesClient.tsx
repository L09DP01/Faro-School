"use client";
import {MessageSources} from "@/components/messaging/MessageSources";

import { useState, useTransition, useEffect, useRef, useMemo } from "react";
import {
  MessageSquare,
  Sparkles,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Search,
  ArrowLeft,
  X,
  UserCheck,
  CheckCheck,
  BookOpen,
  TrendingUp,
} from "lucide-react";
import {
  sendPrivateMessageAction,
  loadStaffInboxAction,
  closeConversationAction,
  startInstructorConversationAction,
  markConversationReadAction,
} from "@/app/actions/private-messaging";
import type { Conversation, PrivateMessage } from "@/lib/messaging/types";
import type { StudentItem, AdminCourseOption } from "@/lib/admin/student-types";

interface InstructorMessagesClientProps {
  initialConversations: Conversation[];
  initialActiveId?: string | null;
  initialNewStudentId?: string | null;
  enrolledStudents: StudentItem[];
  instructorCourses: AdminCourseOption[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: "instructor" | "admin";
  locale: string;
}

const QUICK_REPLIES_FR = [
  "Consulte le chapitre 2 pour l'exemple pratique.",
  "Regarde la ressource téléchargeable dans la leçon.",
  "Excellent travail ! Continue sur cette voie.",
  "Je vérifie cela et je reviens vers toi rapidement.",
];

const QUICK_REPLIES_HT = [
  "Gade chapit 2 a pou w jwenn egzanp pratik la.",
  "Gade dokiman ki disponib pou telechaje nan leson an.",
  "Bèl travay ! Kontinye konsa.",
  "M ap tcheke sa pou ou epi m ap reponn ou rapidman.",
];

export function InstructorMessagesClient({
  initialConversations,
  initialActiveId,
  initialNewStudentId,
  enrolledStudents,
  instructorCourses,
  currentUserId,
  currentUserName,
  currentUserRole,
  locale,
}: InstructorMessagesClientProps) {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(
    initialActiveId || (initialConversations.length > 0 ? initialConversations[0].id : null)
  );
  const [messagesMap, setMessagesMap] = useState<Record<string, PrivateMessage[]>>({});
  const [statusFilter, setStatusFilter] = useState<"all" | "waiting" | "ai" | "replied" | "closed">("all");
  const [search, setSearch] = useState("");
  const [inputText, setInputText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Modal: Start conversation
  const [isNewModalOpen, setIsNewModalOpen] = useState(Boolean(initialNewStudentId));
  const [newStudentId, setNewStudentId] = useState(initialNewStudentId || "");
  const [newCourseId, setNewCourseId] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newFirstMessage, setNewFirstMessage] = useState("");
  const [newModalError, setNewModalError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isHt = locale === "ht";


  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId]
  );

  const quickReplies = activeConversation?.courseId ? (isHt?QUICK_REPLIES_HT:QUICK_REPLIES_FR) : (isHt?["Mwen resevwa demann ou a.","Ki etap ki bay pwoblèm nan?","M ap verifye sa pou ou."]:["J’ai bien reçu votre demande.","À quelle étape rencontrez-vous ce problème ?","Je vérifie cela pour vous."]);
  const activeStudent = useMemo(() => {
    if (!activeConversation) return null;
    return enrolledStudents.find((s) => s.id === activeConversation.studentId) || null;
  }, [activeConversation, enrolledStudents]);

  const activeMessages = useMemo(
    () => (activeId ? messagesMap[activeId] || [] : []),
    [activeId, messagesMap]
  );

  const showNotification = (message: string, type: "success" | "error" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Poll the persisted inbox. Never synthesize a message or an AI reply.
  useEffect(()=>{let alive=true;const refresh=async()=>{if(document.visibilityState!=='visible')return;try{const result=await loadStaffInboxAction(activeId||undefined);if(alive&&result.success&&result.data){setConversations(result.data.conversations);if(activeId){setMessagesMap(prev=>({...prev,[activeId]:result.data!.messages}));const read=await markConversationReadAction(activeId);if(read.success)window.dispatchEvent(new Event("faro:unread-changed"));}}}catch{if(alive)setNotification({message:isHt?'Mesaj yo pa disponib.':'Chargement des messages indisponible.',type:'error'});}};void refresh();const timer=setInterval(refresh,5000);window.addEventListener('focus',refresh);return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',refresh);};},[activeId,isHt]);
  useEffect(()=>{const pane=messagesEndRef.current?.parentElement;if(pane)pane.scrollTop=pane.scrollHeight;},[activeMessages.length]);

  // Filtered conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      // Status filter
      if (statusFilter === "waiting") {
        if (c.status !== "waiting_staff" && c.status !== "open") return false;
      } else if (statusFilter === "ai") {
        if (c.status !== "ai_handling") return false;
      } else if (statusFilter === "replied") {
        if (c.status !== "staff_replied") return false;
      } else if (statusFilter === "closed") {
        if (c.status !== "closed") return false;
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchName = c.studentName?.toLowerCase().includes(q);
        const matchSubject = c.subject?.toLowerCase().includes(q);
        const matchCourse = c.courseTitle?.toLowerCase().includes(q);
        if (!matchName && !matchSubject && !matchCourse) return false;
      }

      return true;
    });
  }, [conversations, statusFilter, search]);

  // Counts for tabs
  const counts = useMemo(() => {
    return {
      all: conversations.length,
      waiting: conversations.filter((c) => c.status === "waiting_staff" || c.status === "open").length,
      ai: conversations.filter((c) => c.status === "ai_handling").length,
      replied: conversations.filter((c) => c.status === "staff_replied").length,
      closed: conversations.filter((c) => c.status === "closed").length,
    };
  }, [conversations]);

  // Send reply handler
  const handleSendReply = () => {
    if (!activeId || !inputText.trim() || isPending) return;

    const trimmed = inputText.trim();
    const nowIso = new Date().toISOString();

    const optimisticMsg: PrivateMessage = {
      id: `opt-${Date.now()}`,
      conversationId: activeId,
      senderType: "staff",
      senderId: currentUserId,
      senderName: currentUserName,
      senderRole: currentUserRole,
      body: trimmed,
      createdAt: nowIso,
      isOptimistic: true,
    };

    setMessagesMap((prev) => ({
      ...prev,
      [activeId]: [...(prev[activeId] || []), optimisticMsg],
    }));

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? {
              ...c,
              status: "staff_replied",
              lastMessageAt: nowIso,
              lastMessagePreview: trimmed,
            }
          : c
      )
    );

    setInputText("");

    startTransition(async () => {
      const res = await sendPrivateMessageAction(activeId, trimmed, crypto.randomUUID(), locale);
      if (!res.success) {
        setMessagesMap(prev=>({...prev,[activeId]:(prev[activeId]||[]).filter(m=>m.id!==optimisticMsg.id)}));
        setInputText(trimmed);
        showNotification(res.error || "Erreur lors de l'envoi.", "error");
        if(activeConversation)setConversations(prev=>prev.map(c=>c.id===activeId?activeConversation:c));
      }
    });
  };

  // Close or Reopen conversation
  const handleToggleClose = () => {
    if (!activeConversation || isPending) return;
    const isCurrentlyClosed = activeConversation.status === "closed";
    const newStatus = isCurrentlyClosed ? "open" : "closed";

    startTransition(async () => {
      const res = await closeConversationAction(activeConversation.id, newStatus);
      if (res.success) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversation.id ? { ...c, status: newStatus } : c
          )
        );
        showNotification(
          isCurrentlyClosed
            ? isHt
              ? "Konvèsasyon an relouvri."
              : "Discussion rouverte avec succès."
            : isHt
              ? "Konvèsasyon an make kòm fèmen."
              : "Discussion clôturée avec succès.",
          "success"
        );
      } else {
        showNotification(res.error || "Erreur lors de l'opération.", "error");
      }
    });
  };

  // Start new conversation submit
  const handleCreateConversationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentId || !newSubject.trim() || !newFirstMessage.trim()) {
      setNewModalError(
        isHt ? "Tanpri ranpli tout chan yo." : "Veuillez remplir tous les champs obligatoires."
      );
      return;
    }

    setNewModalError(null);
    startTransition(async () => {
      const res = await startInstructorConversationAction(
        newStudentId,
        newCourseId,
        newSubject,
        newFirstMessage
      );

      if (res.success && res.data) {
        showNotification(
          isHt ? "Mesaj la voye bay elèv la !" : "Discussion initiée avec l'apprenant !",
          "success"
        );
        setIsNewModalOpen(false);
        setNewSubject("");
        setNewFirstMessage("");
        setActiveId(res.data.conversationId);
      } else {
        setNewModalError(res.error || "Erreur lors de l'envoi.");
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "waiting_staff":
      case "open":
        return {
          label: isHt ? "Ap tann ou" : "En attente",
          className: "bg-orange-tint text-orange border-orange/20",
        };
      case "ai_handling":
        return {
          label: isHt ? "IA a reponn" : "IA a répondu",
          className: "bg-blue-tint text-blue border-blue/20",
        };
      case "staff_replied":
        return {
          label: isHt ? "Reponn" : "Répondu",
          className: "bg-ok-tint text-ok border-ok/20",
        };
      case "closed":
        return {
          label: isHt ? "Fèmen" : "Clôturé",
          className: "bg-line text-muted-faro border-line",
        };
      default:
        return {
          label: status,
          className: "bg-bg text-ink border-line",
        };
    }
  };

  return (
    <div data-staff-inbox data-inbox-active={Boolean(activeId)} className="flex flex-col flex-1 min-h-0 min-w-0 gap-3 sm:gap-4 overflow-hidden">
      {/* Toast Notification */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 text-xs font-semibold shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${
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

      {/* Header bar */}
      <div data-inbox-page-heading className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <nav aria-label="Fil d'Ariane" className="text-xs text-muted-faro hidden sm:flex items-center gap-1.5 mb-1">
            <span>Administration</span>
            <span aria-hidden="true">/</span>
            <span className="text-ink font-medium" aria-current="page">
              {isHt ? "Mesaj Prive" : "Messagerie Directe"}
            </span>
          </nav>
          <h1 className="font-heading font-bold text-lg sm:text-2xl text-ink">
            {currentUserRole === "admin" ? (isHt ? "Sipò teknik ak kou mwen yo" : "Support technique et mes cours") : (isHt ? "Bwat mesaj pwofesè" : "Boîte de réception professeur")}
          </h1>
          <p className="hidden sm:block text-xs text-muted-faro">
            {currentUserRole==='admin'?(isHt?'Reponn tikè teknik yo ak kesyon sou kou ou yo.':'Répondez aux tickets techniques et aux questions concernant vos propres cours.'):(isHt?'Reponn kesyon elèv ki nan kou ou yo.':'Répondez aux questions des élèves de vos formations.')}
          </p>
        </div>

        {currentUserRole === "admin" ? <button
          onClick={() => setIsNewModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange hover:bg-orange-strong text-white text-xs font-heading font-semibold shadow-orange transition-all shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{isHt ? "Nouvo diskisyon" : "Nouvelle discussion"}</span>
        </button> : null}
      </div>

      {/* 2-Panel Layout Card */}
      <div className="rounded-[18px] border border-line bg-surface shadow-card overflow-hidden grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 min-w-0">
        {/* LEFT PANEL: Filters & Conversations List (5 cols) */}
        <section
          aria-label="Liste des conversations"
          className={`lg:col-span-5 min-h-0 min-w-0 overflow-hidden border-r border-line flex flex-col bg-bg/20 ${
            activeId ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Search bar */}
          <div className="shrink-0 p-3.5 border-b border-line bg-surface">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-faro absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  isHt
                    ? "Chèche pa elèv oswa fòmasyon..."
                    : "Rechercher un élève ou un sujet..."
                }
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-line bg-bg text-ink placeholder:text-muted-faro focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange/30"
              />
            </div>

            {/* Filter pills */}
            <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1 text-[11px] no-scrollbar">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  statusFilter === "all"
                    ? "bg-ink text-surface"
                    : "bg-surface text-muted-faro hover:text-ink border border-line"
                }`}
              >
                {isHt ? "Tout" : "Tous"} ({counts.all})
              </button>
              <button
                onClick={() => setStatusFilter("waiting")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  statusFilter === "waiting"
                    ? "bg-orange text-white"
                    : "bg-surface text-muted-faro hover:text-ink border border-line"
                }`}
              >
                {isHt ? "Ap tann" : "En attente"} ({counts.waiting})
              </button>
              <button
                onClick={() => setStatusFilter("ai")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  statusFilter === "ai"
                    ? "bg-blue text-white"
                    : "bg-surface text-muted-faro hover:text-ink border border-line"
                }`}
              >
                {isHt ? "IA" : "IA a répondu"} ({counts.ai})
              </button>
              <button
                onClick={() => setStatusFilter("replied")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  statusFilter === "replied"
                    ? "bg-ok text-white"
                    : "bg-surface text-muted-faro hover:text-ink border border-line"
                }`}
              >
                {isHt ? "Reponn" : "Répondu"} ({counts.replied})
              </button>
              <button
                onClick={() => setStatusFilter("closed")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  statusFilter === "closed"
                    ? "bg-muted-faro text-white"
                    : "bg-surface text-muted-faro hover:text-ink border border-line"
                }`}
              >
                {isHt ? "Fèmen" : "Clôturé"} ({counts.closed})
              </button>
            </div>
          </div>

          {/* Conversations list */}
          <div data-conversation-list tabIndex={0} aria-label={isHt?"Diskisyon yo":"Conversations"} className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar divide-y divide-line/60">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-faro space-y-2">
                <MessageSquare className="w-8 h-8 text-muted-faro/40 mx-auto" />
                <p>{isHt ? "Okenn konvèsasyon pa koresponn." : "Aucune conversation ne correspond."}</p>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isSelected = c.id === activeId;
                const badge = getStatusBadge(c.status);
                const initials =
                  c.studentName
                    ?.split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase() || "EL";

                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`w-full text-left p-4 transition-colors flex items-start gap-3.5 focus-visible:outline-none ${
                      isSelected
                        ? "bg-surface border-l-4 border-l-orange"
                        : "hover:bg-surface/80"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-tint text-blue font-bold text-xs flex items-center justify-center shrink-0 border border-blue/20">
                      {initials}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-heading font-semibold text-xs text-ink truncate">
                          {c.studentName}
                        </span>
                        <span className="text-[10px] text-muted-faro shrink-0">
                          {new Date(c.lastMessageAt).toLocaleDateString(
                            isHt ? "ht-HT" : "fr-FR",
                            { day: "numeric", month: "short" }
                          )}
                        </span>
                      </div>

                      <p className="text-[11px] font-medium text-ink truncate">
                        {c.subject}
                      </p>

                      <p className="text-[11px] text-muted-faro line-clamp-1">
                        {c.lastMessagePreview || "Nouvelle conversation..."}
                      </p>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-muted-faro truncate max-w-[140px] flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-orange shrink-0" />
                          <span className="truncate">{c.courseTitle}</span>
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* RIGHT PANEL: Active Conversation View (7 cols) */}
        <section
          aria-label="Contenu de la conversation"
          className={`lg:col-span-7 min-h-0 min-w-0 overflow-hidden flex-col bg-surface ${
            activeId ? "flex" : "hidden lg:flex"
          }`}
        >
          {activeConversation ? (
            <>
              {/* Header */}
              <div data-conversation-header className="shrink-0 p-3 sm:p-4 border-b border-line flex flex-wrap items-center justify-between bg-surface gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setActiveId(null)}
                    className="lg:hidden p-1.5 rounded-lg border border-line text-muted-faro hover:text-ink hover:bg-bg transition-colors"
                    aria-label={isHt?"Retounen nan lis la":"Retour à la liste"}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div className="w-9 h-9 rounded-full bg-blue-tint text-blue font-bold text-xs flex items-center justify-center shrink-0 border border-blue/20">
                    {activeConversation.studentName?.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="font-heading font-bold text-sm text-ink truncate">
                        {activeConversation.studentName}
                      </h2>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          getStatusBadge(activeConversation.status).className
                        }`}
                      >
                        {getStatusBadge(activeConversation.status).label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-muted-faro mt-0.5">
                      <span className="truncate">{activeConversation.courseTitle}</span>
                      {activeStudent?.progressPercent !== undefined && (
                        <>
                          <span>•</span>
                          <span className="text-orange font-semibold flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {activeStudent.progressPercent}% {isHt ? "konplete" : "terminé"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleToggleClose}
                    disabled={isPending}
                    className={`px-3 py-1.5 rounded-xl text-xs font-heading font-semibold border transition-colors ${
                      activeConversation.status === "closed"
                        ? "border-line bg-bg text-ink hover:bg-line/40"
                        : "border-line text-muted-faro hover:text-ink hover:bg-bg"
                    }`}
                  >
                    {activeConversation.status === "closed"
                      ? isHt
                        ? "Relouvri"
                        : "Rouvrir"
                      : isHt
                        ? "Fèmen diskisyon an"
                        : "Clôturer la discussion"}
                  </button>
                </div>
              </div>

              {/* Messages scroll area */}
              <div data-message-stream tabIndex={0} aria-label={isHt?"Mesaj diskisyon an":"Messages de la conversation"} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain no-scrollbar p-4 sm:p-5 space-y-4 bg-bg/30">
                {activeMessages.map((msg) => {
                  if (msg.senderType === "system") {
                    return (
                      <div key={msg.id} className="flex justify-center my-2">
                        <span className="px-3 py-1 rounded-full bg-line/60 text-muted-faro text-[11px] font-medium text-center max-w-md">
                          {msg.body}<MessageSources meta={msg.meta} locale={locale}/>
                        </span>
                      </div>
                    );
                  }

                  const isInstructorSender = msg.senderType === "staff";
                  const isAiSender = msg.senderType === "ai";

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        isInstructorSender
                          ? "items-end"
                          : "items-start"
                      }`}
                    >
                      {/* Sender label */}
                      <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px]">
                        {isAiSender ? (
                          <span className="font-heading font-bold text-blue flex items-center gap-1 bg-blue-tint px-2 py-0.5 rounded-md border border-blue/20">
                            <Sparkles className="w-3 h-3 text-blue" />
                            {msg.meta?.assistantMode==='support'?(isHt?'Asistan sipò Faro School':'Assistant support Faro School'):(isHt?'Asistan pedagojik':'Assistant pédagogique')}
                            {msg.meta?.confidence && (
                              <span className="text-[10px] text-muted-faro font-normal ml-1">
                                (Confiance: {Math.round(msg.meta.confidence * 100)}%)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="font-heading font-semibold text-ink">
                            {isInstructorSender ? (msg.senderId === currentUserId ? (isHt ? "Ou menm" : "Vous") : msg.senderName || "Faro School") : msg.senderName}
                          </span>
                        )}
                        <span className="text-muted-faro text-[10px]">
                          {new Date(msg.createdAt).toLocaleTimeString(
                            isHt ? "ht-HT" : "fr-FR",
                            { hour: "2-digit", minute: "2-digit" }
                          )}
                        </span>
                      </div>

                      {/* Bubble */}
                      <div
                        className={`p-3.5 rounded-2xl max-w-[85%] sm:max-w-[75%] text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                          isInstructorSender
                            ? "bg-chat-bubble-own border border-ok/20 text-ink rounded-tr-sm"
                            : isAiSender
                              ? "bg-blue-tint/60 border border-blue/30 text-ink rounded-bl-sm"
                              : "bg-surface border border-line text-ink rounded-bl-sm"
                        }`}
                      >
                        {msg.body}<MessageSources meta={msg.meta} locale={locale}/>

                        {isAiSender && (
                          <div className="mt-2 pt-2 border-t border-blue/15 flex items-center justify-between text-[10px] text-muted-faro">
                            <span>Réponse automatique générée par l&apos;IA</span>
                            <span className="font-mono text-[9px]">{msg.meta?.model || "Haiku"}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Replies chips */}
              <div data-quick-replies className="shrink-0 p-2.5 bg-surface border-t border-line/60 overflow-x-auto no-scrollbar flex items-center gap-2">
                <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-muted-faro shrink-0">
                  {isHt ? "Repons rapid :" : "Réponses rapides :"}
                </span>
                {quickReplies.map((reply, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInputText(reply)}
                    className="px-2.5 py-1 rounded-lg bg-bg border border-line hover:border-orange/40 hover:bg-orange/5 text-ink text-[11px] whitespace-nowrap transition-colors focus-visible:outline-none"
                  >
                    {reply}
                  </button>
                ))}
              </div>

              {/* Composer */}
              <footer data-message-composer className="shrink-0 p-3 bg-surface border-t border-line">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <textarea
                      rows={2}
                      placeholder={
                        isHt
                          ? "Ekri repons ou an bay elèv la (pran relè asistan IA a)..."
                          : "Prendre le relais et répondre à l'apprenant..."
                      }
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply();
                        }
                      }}
                      className="w-full min-h-11 max-h-28 resize-none p-3 text-base rounded-xl bg-bg border border-line text-ink placeholder:text-muted-faro focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange/30 transition-all"
                    />
                  </div>

                  <button
                    onClick={handleSendReply}
                    disabled={isPending || !inputText.trim()}
                    className={`min-h-11 min-w-11 p-3 rounded-xl bg-orange text-white font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                      !inputText.trim()
                        ? "opacity-40 cursor-not-allowed"
                        : "bg-orange hover:bg-orange-strong active:scale-95 shadow-orange"
                    }`}
                    title={isHt ? "Voye repons la" : "Envoyer la réponse"}
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline text-xs">
                      {isHt ? "Reponn" : "Répondre"}
                    </span>
                  </button>
                </div>
              </footer>
            </>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col items-center justify-center p-5 sm:p-8 text-center text-muted-faro space-y-3">
              <div className="w-16 h-16 rounded-full bg-surface border border-line flex items-center justify-center shadow-subtle">
                <MessageSquare className="w-8 h-8 text-orange" />
              </div>
              <h3 className="font-heading font-bold text-base text-ink">
                {isHt ? "Chwazi yon konvèsasyon" : "Sélectionnez une conversation"}
              </h3>
              <p className="text-xs text-muted-faro max-w-sm leading-relaxed">
                {isHt
                  ? "Klike sou yon elèv nan lis la pou w li kesyon li epi reponn li."
                  : "Sélectionnez un échange dans la colonne de gauche pour consulter l'historique et répondre directement."}
              </p>
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange hover:bg-orange-strong text-white text-xs font-heading font-semibold shadow-orange transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>{isHt ? "Kòmanse yon diskisyon" : "Nouvelle discussion"}</span>
              </button>
            </div>
          )}
        </section>
      </div>

      {/* NEW CONVERSATION MODAL */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-modal-title"
            className="w-full max-w-lg max-h-[90dvh] overflow-y-auto no-scrollbar rounded-2xl border border-line bg-surface p-6 shadow-2xl animate-in zoom-in-95 duration-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 id="new-modal-title" className="font-heading font-bold text-base text-ink flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-orange" />
                <span>{isHt ? "Kòmanse yon diskisyon ak yon elèv" : "Initier un échange avec un apprenant"}</span>
              </h3>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="rounded-lg p-1 text-muted-faro hover:text-ink hover:bg-bg transition-colors"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {newModalError && (
              <div className="p-3 rounded-xl bg-red-tint border border-red/20 text-red text-xs">
                {newModalError}
              </div>
            )}

            <form onSubmit={handleCreateConversationSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-heading font-semibold text-ink">
                  {isHt ? "Chwazi elèv la" : "Sélectionner l'apprenant"} *
                </label>
                <select
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value)}
                  className="w-full rounded-xl border border-line bg-bg p-2.5 text-ink focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange/30"
                >
                  <option value="">{isHt ? "-- Chwazi yon elèv --" : "-- Choisir un apprenant --"}</option>
                  {enrolledStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.coursesCount} cours)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-heading font-semibold text-ink">
                  {isHt ? "Kou oswa sipò teknik" : "Formation ou support technique"}
                </label>
                <select
                  value={newCourseId}
                  onChange={(e) => setNewCourseId(e.target.value)}
                  className="w-full rounded-xl border border-line bg-bg p-2.5 text-ink focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange/30"
                >
                  <option value="">{isHt ? "Sipò teknik" : "Support technique"}</option>
                    {instructorCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.titleFr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-heading font-semibold text-ink">
                  {isHt ? "Sijè" : "Sujet"} *
                </label>
                <input
                  type="text"
                  placeholder={isHt ? "Eg: Pwogresyon nan modil 3" : "Ex: Suivi sur les exercices pratiques du Module 3"}
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full rounded-xl border border-line bg-bg p-2.5 text-ink focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange/30"
                />
              </div>

              <div className="space-y-1">
                <label className="font-heading font-semibold text-ink">
                  {isHt ? "Premye mesaj ou a" : "Votre message"} *
                </label>
                <textarea
                  rows={4}
                  placeholder={
                    isHt
                      ? "Ekri mesaj ou a bay elèv la..."
                      : "Bonjour, j'ai remarqué que tu as terminé le chapitre précédent..."
                  }
                  value={newFirstMessage}
                  onChange={(e) => setNewFirstMessage(e.target.value)}
                  className="w-full rounded-xl border border-line bg-bg p-2.5 text-ink focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange/30"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-line text-ink hover:bg-bg transition-colors"
                >
                  {isHt ? "Anile" : "Annuler"}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-xl bg-orange hover:bg-orange-strong text-white font-heading font-semibold shadow-orange transition-all disabled:opacity-50"
                >
                  {isPending
                    ? isHt
                      ? "N ap voye..."
                      : "Envoi..."
                    : isHt
                      ? "Voye mesaj la"
                      : "Envoyer le message"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
