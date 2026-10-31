"use client";
import {MessageSources} from "@/components/messaging/MessageSources";
import {scrollMessagePane} from "@/lib/messaging/scroll";

import { useState, useEffect, useRef, useTransition, useMemo } from "react";
import {useTranslations} from "next-intl";
import {markSystemNotificationsReadAction} from "@/app/actions/student-messaging";
import type {getStudentSystemNotifications} from "@/lib/messaging/data";
import { Link,useRouter } from "@/i18n/navigation";
import {
  MessageSquare,
  Sparkles,
  Send,
  CheckCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Search,
  ArrowLeft,
  CircleDot,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { initAuthenticatedRealtimeClient } from "@/lib/supabase/client";
import {
  sendPrivateMessageAction,
  markConversationReadAction,
} from "@/app/actions/private-messaging";
import { NewConversationModal } from "./NewConversationModal";
import type {
  Conversation,
  PrivateMessage,
  EnrolledCourseOption,
  ConversationStatus,
} from "@/lib/messaging/types";

interface StudentStaffChatViewProps {
  systemNotifications?: Awaited<ReturnType<typeof getStudentSystemNotifications>>;
  conversations: Conversation[];
  activeConversation: Conversation | null;
  initialMessages: PrivateMessage[];
  currentUserId: string;
  currentUserRole: "student" | "instructor" | "admin";
  currentUserName: string;
  enrolledCourses: EnrolledCourseOption[];
  locale: string;
}

export function StudentStaffChatView({
  systemNotifications=[],
  conversations: initialConversations,
  activeConversation,
  initialMessages,
  currentUserId,
  currentUserRole,
  currentUserName,
  enrolledCourses,
  locale,
}: StudentStaffChatViewProps) {
  const [conversations,setConversations] = useState<Conversation[]>(initialConversations);
  const router=useRouter();
  useEffect(()=>{setConversations(initialConversations);},[initialConversations]);
  const t=useTranslations('messagingFlow');
  const [inboxFilter,setInboxFilter]=useState<'all'|'tickets'|'courses'|'system'>('all');
  useEffect(()=>{if(inboxFilter==='system')void markSystemNotificationsReadAction().catch(()=>{});},[inboxFilter]);

  const [messages, setMessages] = useState<PrivateMessage[]>(initialMessages);
  const [inputText, setInputText] = useState("");
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();

  const isHt = locale === "ht";
  const isStaffView = currentUserRole === "instructor" || currentUserRole === "admin";

  // Refresh the inbox when its own conversations/system notifications change.
  useEffect(()=>{
    if(isStaffView)return;
    let disposed=false,channel:any=null,timer:ReturnType<typeof setTimeout>|undefined;
    const refresh=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>router.refresh(),200);};
    void initAuthenticatedRealtimeClient().then(client=>{
      if(disposed)return;
      channel=client.channel('student-inbox-'+currentUserId)
       .on('postgres_changes',{event:'*',schema:'public',table:'conversations',filter:'student_id=eq.'+currentUserId},refresh)
       .on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:'user_id=eq.'+currentUserId},refresh)
       .subscribe();
    }).catch(()=>{});
    return()=>{disposed=true;if(timer)clearTimeout(timer);if(channel)void channel.unsubscribe();};
  },[currentUserId,isStaffView,router]);

  const activeReadId=activeConversation?.id;
  // Read receipts are sent only while the conversation is visible.
  useEffect(()=>{const mark=()=>{if(activeReadId&&document.visibilityState==='visible')void markConversationReadAction(activeReadId).then(r=>{if(r.success)window.dispatchEvent(new Event('faro:unread-changed'));}).catch(()=>{});};mark();window.addEventListener('focus',mark);document.addEventListener('visibilitychange',mark);return()=>{window.removeEventListener('focus',mark);document.removeEventListener('visibilitychange',mark);};},[activeReadId,messages.length]);

  // Realtime subscription for incoming messages
  useEffect(() => {
    if (!activeConversation) return;
    const convId = activeConversation.id;
    const convStaffName = activeConversation.staffName;
    const convStudentName = activeConversation.studentName;

    let channel: any = null;
    let isCancelled = false;

    async function setupRealtime() {
      try {
        const supabase = await initAuthenticatedRealtimeClient();
        if (isCancelled) return;

        channel = supabase
          .channel(`private-conv-${convId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `conversation_id=eq.${convId}`,
            },
            (payload: any) => {
              const newRow = payload.new;
              setMessages((prev) => {
                if (prev.some((m) => m.id === newRow.id)) return prev;

                // Filter out optimistic match
                const filtered = prev.filter(
                  (m) =>
                    !(
                      m.isOptimistic &&
                      m.senderId === newRow.sender_id &&
                      m.body === newRow.body
                    )
                );

                const mappedMsg: PrivateMessage = {
                  id: newRow.id,
                  conversationId: newRow.conversation_id,
                  senderType: newRow.sender_type,
                  senderId: newRow.sender_id,
                  senderName:
                    newRow.sender_type === "ai"
                      ? `Assistant IA de ${convStaffName}`
                      : newRow.sender_id === currentUserId
                      ? currentUserName
                      : isStaffView
                      ? convStudentName
                      : convStaffName,
                  senderRole: newRow.sender_type === "student" ? "student" : "instructor",
                  body: newRow.body,
                  meta: newRow.meta || {},
                  createdAt: newRow.created_at,
                  readAt: newRow.read_at,
                };

                return [...filtered, mappedMsg];
              });

              setTimeout(() => {
                scrollMessagePane(messagesEndRef.current,"smooth");
              }, 50);
            }
          )
          .subscribe();
      } catch {}
    }

    setupRealtime();

    return () => {
      isCancelled = true;
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [activeConversation, currentUserId, currentUserName, isStaffView]);

  // Scroll to bottom on initial render
  useEffect(() => {
    scrollMessagePane(messagesEndRef.current);
  }, [messages.length]);

  // Filtered conversations list
  const filteredConversations = useMemo(() => {
    const eligible=conversations.filter(c=>inboxFilter==='all'||(inboxFilter==='tickets'?!c.courseId:inboxFilter==='courses'?!!c.courseId:false));
    if (!searchQuery.trim()) return eligible;
    const q = searchQuery.toLowerCase();
    return eligible.filter(
      (c) =>
        c.subject.toLowerCase().includes(q) ||
        (c.courseTitle && c.courseTitle.toLowerCase().includes(q)) ||
        c.staffName.toLowerCase().includes(q) ||
        c.studentName.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery,inboxFilter]);

  const isSendingRef = useRef(false);

  // Handle message submission
  const handleSendMessage = () => {
    if (isSendingRef.current || isPending) return;
    const trimmed = inputText.trim();
    if (!trimmed || !activeConversation) return;

    isSendingRef.current = true;
    setErrorMessage(null);

    const clientMessageId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `cid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const optimisticMessage: PrivateMessage = {
      id: clientMessageId,
      conversationId: activeConversation.id,
      senderType: isStaffView ? "staff" : "student",
      senderId: currentUserId,
      senderName: currentUserName,
      senderRole: currentUserRole,
      body: trimmed,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
      clientMessageId,
    } as any;

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputText("");

    setTimeout(() => {
      scrollMessagePane(messagesEndRef.current,"smooth");
    }, 50);

    startTransition(async () => {
      try {
        const res = await sendPrivateMessageAction(
          activeConversation.id,
          trimmed,
          clientMessageId,
          locale
        );
        if (!res.success) {
          setErrorMessage(res.error || "Impossible d'envoyer le message.");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === clientMessageId
                ? ({ ...m, failedToSend: true, errorMessage: res.error } as any)
                : m
            )
          );
        } else if (res.data) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === clientMessageId || (m as any).clientMessageId === clientMessageId
                ? res.data!
                : m
            )
          );
        }
      } finally {
        isSendingRef.current = false;
      }
    });
  };

  const getStatusBadge = (status: ConversationStatus) => {
    switch (status) {
      case "open":
        return (
          <span className="px-2 py-0.5 rounded-full bg-blue-tint text-blue text-[10px] font-bold">
            {isHt ? "Ouvè" : "Ouvert"}
          </span>
        );
      case "ai_handling":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-tint text-orange text-[10px] font-bold border border-orange/20">
            <Sparkles className="w-2.5 h-2.5" />
            <span>{isHt ? "IA ap jere" : "Assistant IA"}</span>
          </span>
        );
      case "waiting_staff":
        return (
          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300">
            {isHt ? "Ap tann repons" : "En attente"}
          </span>
        );
      case "staff_replied":
        return (
          <span className="px-2 py-0.5 rounded-full bg-ok-tint text-ok text-[10px] font-bold border border-ok/20">
            {isHt ? "Fòmatè reponn" : "Répondu"}
          </span>
        );
      case "closed":
        return (
          <span className="px-2 py-0.5 rounded-full bg-surface border border-line text-muted-faro text-[10px] font-bold">
            {isHt ? "Fèmen" : "Clôturé"}
          </span>
        );
    }
  };

  return (
    <>
      <div className="relative flex h-full min-h-0 flex-1 w-full gap-4 md:gap-5 overflow-hidden bg-transparent">
        {/* ========================================================================= */}
        {/* 1. LEFT PANEL: CONVERSATIONS INBOX                                       */}
        {/* ========================================================================= */}
        <aside
          className={`w-full md:w-[380px] lg:w-[410px] shrink-0 rounded-[20px] bg-white border border-line/60 shadow-sm flex flex-col justify-between overflow-hidden p-5 transition-transform duration-200 ${
            activeConversation ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="flex flex-col h-full min-h-0">
            {/* Header + New Conversation Button */}
            <div className="pb-4 border-b border-line/60 space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-heading font-bold text-ink leading-tight">
                    {isStaffView ? (isHt?"Mesaj elèv yo":"Messages étudiants") : t("inbox")}
                  </h2>
                  <p className="text-xs text-muted-faro mt-0.5">
                    {isStaffView
                      ? "Discussions pédagogiques directes"
                      : t("inboxHelp")}
                  </p>
                </div>

                {!isStaffView && (
                  <button
                    onClick={() => setIsNewModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-orange hover:bg-orange-strong text-white text-xs font-heading font-semibold shadow-orange transition-all active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t("write")}</span>
                  </button>
                )}
              </div>

              {!isStaffView&&<div role="tablist" aria-label={t('inbox')} className="flex gap-1 overflow-x-auto pb-1">{(['all','tickets','courses','system'] as const).map(filter=><button type="button" role="tab" key={filter} aria-selected={inboxFilter===filter} onClick={()=>setInboxFilter(filter)} className={`min-h-11 shrink-0 rounded-full px-3 text-xs font-semibold ${inboxFilter===filter?'bg-navy-deep text-white':'bg-bg text-muted-faro'}`}>{t(filter)}</button>)}</div>}
              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-muted-faro" />
                <input
                  type="text"
                  placeholder={isHt ? "Chèche yon konvèsasyon..." : "Rechercher un échange..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-full bg-slate-panel border-0 text-xs text-ink placeholder:text-muted-faro focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange/30 transition-all"
                />
              </div>
            </div>

            {/* Conversation Items List */}
            <div className="flex-1 min-h-0 overflow-y-auto py-3 space-y-2 focus-visible:outline-none">
              {inboxFilter==='system'?<div className="space-y-3">{systemNotifications.length===0?<p className="p-4 text-sm text-muted-faro">{t('systemEmpty')}</p>:systemNotifications.map(notification=><article key={notification.id} className="rounded-xl border border-line bg-surface p-4"><p className="font-heading text-sm font-bold text-ink">{notification.senderName||t('systemMessage')}</p>{notification.courseTitle&&<p className="mt-1 text-xs text-muted-faro">{notification.courseTitle}</p>}{notification.message&&<p className="mt-2 break-words text-sm text-ink">{notification.message}</p>}<time className="mt-2 block text-xs text-muted-faro">{new Date(notification.createdAt).toLocaleDateString(locale==='ht'?'fr-HT':'fr-FR')}</time>{notification.conversationId&&<Link href={`/dashboard/messages/${encodeURIComponent(notification.conversationId)}` as any} className="mt-3 inline-block text-sm font-semibold text-orange">{t('viewConversation')}</Link>}</article>)}</div>:filteredConversations.length === 0 ? (
                <div className="py-12 text-center text-muted-faro space-y-2">
                  <div className="w-14 h-14 rounded-full bg-blue-tint text-navy-deep flex items-center justify-center mx-auto mb-2 shadow-2xs">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-heading font-bold text-ink">
                    {isHt ? "Pa gen okenn konvèsasyon" : "Aucune conversation"}
                  </p>
                  <p className="text-xs text-muted-faro max-w-[200px] mx-auto leading-relaxed">
                    {isHt
                      ? "Klike sou 'Nouvo' pou poze fòmatè w la yon kesyon dirèk."
                      : t("emptyHelp")}
                  </p>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isActive = activeConversation?.id === conv.id;
                  const targetUrl = isStaffView
                    ? `/admin/messages/${conv.id}`
                    : `/dashboard/messages/${conv.id}`;

                  return (
                    <Link
                      key={conv.id}
                      href={targetUrl as any}
                      className={`block p-3.5 rounded-2xl transition-all ${
                        isActive
                          ? "bg-blue-tint border border-blue/20 shadow-2xs"
                          : "bg-surface hover:bg-bg border border-transparent hover:border-line/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="font-heading font-bold text-xs text-ink truncate max-w-[190px]">
                          {conv.subject}
                        </span>
                        <span className="text-[10px] text-muted-faro shrink-0">
                          {new Date(conv.lastMessageAt).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-muted-faro mb-2 truncate">
                        <span className="font-medium text-ink truncate">
                          {isStaffView ? conv.studentName : conv.staffName}
                        </span>
                        <span>•</span>
                        <span className="truncate">{conv.courseTitle}</span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        {getStatusBadge(conv.status)}
                        {conv.unreadCount && conv.unreadCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-orange text-white text-[10px] font-bold shadow-xs">
                            {conv.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* ========================================================================= */}
        {/* 2. RIGHT PANEL: CHAT WINDOW                                              */}
        {/* ========================================================================= */}
        <section
          className={`flex-1 flex flex-col h-full rounded-[20px] bg-white border border-line/60 shadow-sm relative overflow-hidden ${
            activeConversation ? "flex" : "hidden md:flex"
          }`}
        >
          {activeConversation ? (
            <>
              {/* Header */}
              <header className="shrink-0 min-h-[72px] py-3 px-4 md:px-6 border-b border-line/60 bg-white flex items-center justify-between gap-3 shadow-subtle z-10">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Mobile Back Button */}
                  <Link
                    aria-label={t("back")}
                    href={(isStaffView ? "/admin/messages" : "/dashboard/messages") as any}
                    className="md:hidden p-1.5 rounded-lg text-muted-faro hover:text-ink hover:bg-bg"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Link>

                  {/* Avatar */}
                  <div className="shrink-0 w-11 h-11 rounded-full bg-navy-deep text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    {(isStaffView
                      ? activeConversation.studentName
                      : activeConversation.staffName
                    )
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h1 className="font-heading min-w-0 flex-1 font-bold text-base text-ink truncate leading-tight">
                        {isStaffView
                          ? activeConversation.studentName
                          : activeConversation.staffName}
                      </h1>

                      {!isStaffView && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange text-white text-[10px] font-bold uppercase tracking-wider shadow-2xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue fill-blue text-white" />
                          {t(activeConversation.staffRole==='admin'?'adminBadge':'teacherBadge')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-faro mt-0.5 truncate">
                      <span className="truncate">{activeConversation.courseTitle}</span>
                      <span>·</span>
                      {/* Presence indicator for staff */}
                      <span className="inline-flex items-center gap-1.5 font-medium text-[11px]">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            activeConversation.isStaffOnline
                              ? "bg-ok"
                              : "bg-slate-300"
                          }`}
                        />
                        <span
                          className={
                            activeConversation.isStaffOnline ? "text-ok font-semibold" : "text-muted-faro"
                          }
                        >
                          {activeConversation.isStaffOnline
                            ? isHt
                              ? "An liy"
                              : "En ligne"
                            : isHt
                              ? "Pa an liy"
                              : "Hors ligne"}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-2">
                  {getStatusBadge(activeConversation.status)}
                </div>
              </header>

              {/* Message Stream */}
              <div data-message-stream className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-4 focus-visible:outline-none bg-chat-bg chat-dotted-background [background-size:20px_20px]">
                {/* Subject Header Banner */}
                <div className="p-3.5 rounded-2xl bg-white border border-line/60 shadow-2xs flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-muted-faro uppercase">
                      {isHt ? "Sijè echanj la" : "Objet"} :
                    </span>
                    <strong className="text-ink ml-1.5 font-heading text-xs sm:text-sm">
                      {activeConversation.subject}
                    </strong>
                  </div>
                  <span className="text-muted-faro text-[11px]">
                    {new Date(activeConversation.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>

                {/* Messages list */}
                {messages.map((msg) => {
                  const isOwn = msg.senderId === currentUserId;
                  const isAi = msg.senderType === "ai";
                  const isSystem = msg.senderType === "system";

                  // System Message Centered
                  if (isSystem) {
                    return (
                      <div key={msg.id} className="flex justify-center my-3">
                        <div className="max-w-md px-4 py-1.5 rounded-full bg-slate-100 border border-line/60 text-xs text-muted-faro text-center shadow-2xs leading-relaxed font-medium">
                          {msg.body}<MessageSources meta={msg.meta} locale={locale}/>
                        </div>
                      </div>
                    );
                  }

                  // AI Message (Special Visuals: Orange-tint bubble, "IA" pill with sparkles)
                  if (isAi) {
                    return (
                      <div key={msg.id} className="flex justify-start gap-3 items-end">
                        <div className="shrink-0 w-9 h-9 rounded-full bg-orange-tint border border-orange/40 text-orange flex items-center justify-center shadow-xs">
                          <Sparkles className="w-4 h-4 text-orange" />
                        </div>
                        <div className="flex flex-col items-start max-w-[85%] sm:max-w-[75%]">
                          {/* Label Pill */}
                          <div className="inline-flex items-center gap-1.5 mb-1 px-2.5 py-0.5 rounded-full bg-orange text-white text-[10px] font-bold shadow-2xs uppercase tracking-wider">
                            <Sparkles className="w-3 h-3 text-white" />
                            <span>{msg.meta?.assistantMode==='support'?(isHt?'Asistan sipò Faro School':'Assistant support Faro School'):(isHt?'Asistan pedagojik':'Assistant pédagogique')}</span>
                          </div>

                          {/* Bubble */}
                          <div className="p-4 rounded-2xl rounded-tl-sm bg-orange-tint/70 border border-orange/30 text-ink shadow-xs text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                            {msg.body}<MessageSources meta={msg.meta} locale={locale}/>

                            <div className="flex items-center justify-end gap-1 mt-1 text-[11px] text-muted-faro">
                              <span>
                                {new Date(msg.createdAt).toLocaleTimeString("fr-FR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Normal User Messages (Student or Staff)
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 group items-end ${
                        isOwn ? "justify-end" : "justify-start"
                      }`}
                    >
                      {!isOwn && (
                        <div className="shrink-0 w-9 h-9 rounded-full bg-navy-deep text-white flex items-center justify-center text-xs font-bold shadow-xs">
                          {(msg.senderName || activeConversation.staffName || "Faro").slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      <div
                        className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${
                          isOwn ? "items-end" : "items-start"
                        }`}
                      >
                        {!isOwn && (
                          <span className="text-xs font-heading font-bold text-ink mb-1 px-1">
                            {msg.senderName || (msg.senderType==='staff'?activeConversation.staffName:t('systemMessage'))}
                          </span>
                        )}

                        <div
                          className={`p-4 rounded-2xl shadow-xs text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words ${
                            isOwn
                              ? "bg-chat-bubble-own border border-ok/20 rounded-tr-sm text-ink"
                              : "bg-white border border-line/40 rounded-tl-sm text-ink"
                          }`}
                        >
                          {msg.body}<MessageSources meta={msg.meta} locale={locale}/>

                          <div className="flex items-center justify-end gap-1 mt-1 text-[11px] text-muted-faro">
                            <span>
                              {new Date(msg.createdAt).toLocaleTimeString("fr-FR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>

                            {isOwn && (
                              <>
                                {(msg as any).failedToSend ? (
                                  <span className="text-red flex items-center gap-0.5 ml-1">
                                    <AlertCircle className="w-3 h-3 text-red" />
                                    <RotateCcw className="w-3 h-3 text-red" />
                                  </span>
                                ) : msg.isOptimistic ? (
                                  <Clock className="w-3 h-3 text-muted-faro ml-1" />
                                ) : (
                                  <span className="text-ok font-bold text-xs ml-1 flex items-center">
                                    <CheckCheck className="w-3.5 h-3.5 text-ok" />
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Error banner */}
              {errorMessage && (
                <div className="mx-4 mb-2 p-2.5 rounded-xl bg-red-tint border border-red text-red text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Composer */}
              <footer data-chat-composer className="shrink-0 bg-white border-t border-line/60 px-3 sm:px-5 py-2.5 sm:py-3.5 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
                <div className="flex items-center gap-2 sm:gap-2.5 w-full">
                  <div className="flex-1 min-w-0 bg-slate-panel rounded-full px-3.5 sm:px-4 py-1.5 sm:py-2 flex items-center gap-2 border border-transparent focus-within:border-orange/40 focus-within:bg-white focus-within:ring-2 focus-within:ring-orange/20 transition-all">
                    <input
                      type="text"
                      placeholder={
                        isHt
                          ? "Ekri mesaj ou a..."
                          : "Écrivez votre message..."
                      }
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="w-full min-w-0 bg-transparent border-0 text-xs sm:text-sm text-ink placeholder:text-muted-faro focus:outline-none py-1 leading-normal"
                    />
                  </div>

                  <button
                    onClick={handleSendMessage}
                    disabled={isPending || !inputText.trim()}
                    className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-orange hover:bg-orange-hover text-white shadow-orange flex items-center justify-center shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                    title={isHt ? "Voye mesaj la" : "Envoyer le message"}
                    aria-label="Envoyer le message"
                  >
                    {isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Send className="w-4 h-4 fill-white text-white ml-0.5" />
                    )}
                  </button>
                </div>
              </footer>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-faro space-y-3">
              <div className="w-16 h-16 rounded-full bg-blue-tint text-navy-deep flex items-center justify-center shadow-2xs">
                <MessageSquare className="w-8 h-8 text-orange" />
              </div>
              <h3 className="font-heading font-bold text-base text-ink">
                {isHt ? "Chwazi yon konvèsasyon" : "Sélectionnez un échange"}
              </h3>
              <p className="text-xs text-muted-faro max-w-sm leading-relaxed">
                {isStaffView
                  ? "Sélectionnez un étudiant dans la liste pour consulter ses questions et lui répondre."
                  : isHt
                  ? "Chwazi yon konvèsasyon sou bò gòch la oswa klike sou 'Nouvo' pou poze yon kesyon."
                  : t("emptyHelp")}
              </p>
              {!isStaffView && (
                <button
                  onClick={() => setIsNewModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-orange hover:bg-orange-strong text-white text-xs font-heading font-semibold shadow-orange transition-all hover:scale-105"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isHt ? "Kòmanse yon konvèsasyon" : "Nouvelle question"}</span>
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {/* New Conversation Modal */}
      <NewConversationModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        enrolledCourses={enrolledCourses}
        locale={locale}
      />
    </>
  );
}
