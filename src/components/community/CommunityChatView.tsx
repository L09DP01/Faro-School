"use client";

import { useState, useEffect, useRef, useTransition, useMemo, Fragment } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { STUDENT_DM_ENABLED } from "@/config/messaging";
import {
  Users,
  Pin,
  X,
  Send,
  Smile,
  Paperclip,
  Mic,
  MessageSquare,
  Search,
  MoreVertical,
  Info,
  CheckCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  CornerUpLeft,
  Trash2,
  Flag,
  ShieldAlert,
  ArrowLeft,
  ChevronDown,
  RotateCcw,
  GraduationCap,
  Plus,
  Loader2,
} from "lucide-react";

// Distinct WCAG AA compliant color classes for participant names on white bubbles
const NAME_CLASSES = [
  "text-indigo-600",
  "text-purple-700",
  "text-blue-600",
  "text-teal-600",
  "text-emerald-700",
  "text-amber-700",
  "text-violet-600",
  "text-fuchsia-700",
  "text-sky-700",
  "text-indigo-800",
];

function getAuthorColorClass(nameOrId: string): string {
  let hash = 0;
  for (let i = 0; i < nameOrId.length; i++) {
    hash = (hash << 5) - hash + nameOrId.charCodeAt(i);
    hash |= 0;
  }
  return NAME_CLASSES[Math.abs(hash) % NAME_CLASSES.length];
}

function formatNumber(num: number, locale: string = "fr"): string {
  return new Intl.NumberFormat(locale === "ht" ? "fr-HT" : "fr-FR")
    .format(num)
    .replace(/[\u202F\s]/g, " ");
}

function formatDateSeparator(dateStr: string, locale: string = "fr"): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) {
    return locale === "ht" ? "Jodi a" : "Aujourd'hui";
  }
  if (isYesterday) {
    return locale === "ht" ? "Yè" : "Hier";
  }
  return new Intl.DateTimeFormat(locale === "ht" ? "fr-HT" : "fr-FR", {
    day: "numeric",
    month: "long",
  }).format(d);
}
import { initAuthenticatedRealtimeClient } from "@/lib/supabase/client";
import {
  postMessageAction,
  toggleReactionAction,
  pinMessageAction,
  deleteMessageAction,
  reportMessageAction,
  moderateUserAction,
  markCommunityReadAction,
  acceptCommunityRulesAction,
} from "@/app/actions/community";
import type {
  CommunityMessage,
  CommunityGroupInfo,
  CommunityMember,
  UserRole,
} from "@/lib/community/types";

interface CommunityChatViewProps {
  initialMessages: CommunityMessage[];
  initialPinnedMessage: CommunityMessage | null;
  groupInfo: CommunityGroupInfo;
  members: CommunityMember[];
  currentUser: {
    id: string;
    fullName: string;
    email: string | null;
    role: UserRole;
  };
  hasAcceptedRules: boolean;
  locale: string;
}

const COMMON_REACTIONS = ["👍", "❤️", "👏", "🔥", "🎉", "💡", "🚀", "🙏"];

export function CommunityChatView({
  initialMessages,
  initialPinnedMessage,
  groupInfo,
  members,
  currentUser,
  hasAcceptedRules: initialAcceptedRules,
  locale,
}: CommunityChatViewProps) {
  const router = useRouter();

  // Messages & Group State
  const [messages, setMessages] = useState<CommunityMessage[]>(initialMessages);
  const [pinnedMessage, setPinnedMessage] = useState<CommunityMessage | null>(initialPinnedMessage);
  const [pinnedBannerDismissed, setPinnedBannerDismissed] = useState(false);
  const [isPinnedExpanded, setIsPinnedExpanded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(groupInfo.unreadCount);
  const [onlineCount, setOnlineCount] = useState(groupInfo.onlineCount);
  const [showConnectionLostBanner, setShowConnectionLostBanner] = useState(false);
  const disconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isMenuDropdownOpen, setIsMenuDropdownOpen] = useState(false);
  const [showNewMessagesChip, setShowNewMessagesChip] = useState(false);

  // Selected Member Profile Modal State
  const [selectedMemberProfile, setSelectedMemberProfile] = useState<{
    id: string;
    displayName: string;
    role: string;
    avatarUrl?: string | null;
  } | null>(null);

  // Composer State
  const [inputText, setInputText] = useState("");
  const [replyingTo, setReplyingTo] = useState<CommunityMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mentions autocomplete state
  const [mentionFilter, setMentionFilter] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState<number>(-1);

  // Rules Modal State
  const [showRulesModal, setShowRulesModal] = useState(!initialAcceptedRules);
  const [rulesCheckboxChecked, setRulesCheckboxChecked] = useState(false);

  // Report Modal State
  const [reportingMessage, setReportingMessage] = useState<CommunityMessage | null>(null);
  const [reportReason, setReportReason] = useState("Spam ou message non sollicité");
  const [reportSuccess, setReportSuccess] = useState(false);

  // Admin Moderation Modal State
  const [moderatingUser, setModeratingUser] = useState<{ id: string; name: string } | null>(null);
  const [moderationAction, setModerationAction] = useState<"mute_1h" | "mute_24h" | "mute_7d" | "ban">("mute_1h");

  // Mobile navigation state: "list" or "chat"
  const [mobileView, setMobileView] = useState<"list" | "chat">("chat");

  // Search filter inside chat
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  // Mark messages as read on mount
  useEffect(() => {
    markCommunityReadAction().then(() => {
      setUnreadCount(0);
    });
  }, []);

  // Supabase Realtime Subscription & Presence
  useEffect(() => {
    let channel: any = null;
    let isCancelled = false;

    async function setupRealtime() {
      try {
        const supabase = await initAuthenticatedRealtimeClient();
        if (isCancelled) return;

        channel = supabase.channel("community-global-room", {
          config: {
            presence: {
              key: currentUser.id,
            },
          },
        });

      channel
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "community_messages" },
          (payload: any) => {
            const newRow = payload.new;
            // Ignore if deleted
            if (newRow.deleted_at) return;

            setMessages((prev) => {
              // Avoid duplicates if already received or optimistically added
              if (prev.some((m) => m.id === newRow.id)) return prev;

              // Find author profile in members
              const authorMember = members.find((m) => m.id === newRow.author_id);
              const authorName = authorMember?.displayName || (newRow.author_id === currentUser.id ? currentUser.fullName : "Membre");
              const authorRole = authorMember?.role || (newRow.author_id === currentUser.id ? currentUser.role : "student");

              const newMsg: CommunityMessage = {
                id: newRow.id,
                authorId: newRow.author_id,
                authorName,
                authorRole,
                authorAvatarUrl: authorMember?.avatarUrl || null,
                body: newRow.body,
                attachmentUrl: newRow.attachment_url || null,
                replyToId: newRow.reply_to_id || null,
                pinned: Boolean(newRow.pinned),
                pinnedAt: newRow.pinned_at || null,
                deletedAt: null,
                createdAt: newRow.created_at,
                reactions: [],
              };

              // Reconcile optimistic message by client_message_id, temp id, or body
              const filtered = prev.filter(
                (m) =>
                  !(
                    m.isOptimistic &&
                    m.authorId === currentUser.id &&
                    (m.id === newRow.client_message_id ||
                      (m as any).clientMessageId === newRow.client_message_id ||
                      m.body === newRow.body)
                  )
              );
              return [...filtered, newMsg];
            });

            // Auto scroll down if user is at bottom, else show "new messages" chip
            const el = chatScrollContainerRef.current;
            const isNearBottom = el
              ? el.scrollHeight - el.scrollTop - el.clientHeight < 140
              : true;

            if (isNearBottom || newRow.author_id === currentUser.id) {
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
              }, 50);
            } else {
              setShowNewMessagesChip(true);
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "community_messages" },
          (payload: any) => {
            const updated = payload.new;
            setMessages((prev) =>
              prev
                .map((m) => {
                  if (m.id === updated.id) {
                    if (updated.deleted_at) return null;
                    return {
                      ...m,
                      pinned: Boolean(updated.pinned),
                      pinnedAt: updated.pinned_at || null,
                      body: updated.body,
                    };
                  }
                  return m;
                })
                .filter(Boolean) as CommunityMessage[]
            );

            if (updated.pinned) {
              setPinnedMessage({
                id: updated.id,
                authorId: updated.author_id,
                authorName: "Modérateur",
                authorRole: "admin",
                body: updated.body,
                pinned: true,
                createdAt: updated.created_at,
                reactions: [],
              });
              setPinnedBannerDismissed(false);
            } else if (pinnedMessage?.id === updated.id && !updated.pinned) {
              setPinnedMessage(null);
            }
          }
        )
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          const count = Object.keys(state).length;
          setOnlineCount(Math.max(count, 142)); // blend mock + real presence
        })
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") {
            if (disconnectTimerRef.current) {
              clearTimeout(disconnectTimerRef.current);
              disconnectTimerRef.current = null;
            }
            setShowConnectionLostBanner(false);
            channel.track({
              user_id: currentUser.id,
              online_at: new Date().toISOString(),
            });
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            if (typeof window !== "undefined" && !window.navigator.onLine) {
              if (!disconnectTimerRef.current) {
                disconnectTimerRef.current = setTimeout(() => {
                  setShowConnectionLostBanner(true);
                }, 3000);
              }
            }
          }
        });
      } catch {
        if (typeof window !== "undefined" && !window.navigator.onLine) {
          if (!disconnectTimerRef.current) {
            disconnectTimerRef.current = setTimeout(() => {
              setShowConnectionLostBanner(true);
            }, 3000);
          }
        }
      }
    }

    setupRealtime();

    const handleOffline = () => {
      if (!disconnectTimerRef.current) {
        disconnectTimerRef.current = setTimeout(() => {
          setShowConnectionLostBanner(true);
        }, 3000);
      }
    };
    const handleOnline = () => {
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      setShowConnectionLostBanner(false);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("offline", handleOffline);
      window.addEventListener("online", handleOnline);
    }

    return () => {
      isCancelled = true;
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("offline", handleOffline);
        window.removeEventListener("online", handleOnline);
      }
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [currentUser.id, currentUser.fullName, currentUser.role, members, pinnedMessage?.id]);

  // Scroll to bottom on initial render
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, []);

  // Filtered messages based on search query
  const displayedMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(
      (m) =>
        m.body.toLowerCase().includes(q) ||
        m.authorName.toLowerCase().includes(q)
    );
  }, [messages, searchQuery]);

  // Handle Mentions typing in input or textarea
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const val = e.target.value;
    setInputText(val);

    const cursorPos = e.target.selectionStart ?? 0;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtMatch = textBeforeCursor.match(/@([a-zA-Z0-9_\u00C0-\u017F]*)$/);

    if (lastAtMatch) {
      setMentionFilter(lastAtMatch[1].toLowerCase());
      setMentionIndex(lastAtMatch.index ?? -1);
    } else {
      setMentionFilter(null);
      setMentionIndex(-1);
    }
  };

  const handleSelectMention = (member: CommunityMember) => {
    if (mentionIndex === -1) return;
    const beforeMention = inputText.slice(0, mentionIndex);
    const afterMention = inputText.slice(mentionIndex + (mentionFilter?.length || 0) + 1);
    const newText = `${beforeMention}@${member.displayName} ${afterMention}`;
    setInputText(newText);
    setMentionFilter(null);
    setMentionIndex(-1);
    textareaRef.current?.focus();
  };

  const filteredMembersForMention = useMemo(() => {
    if (mentionFilter === null) return [];
    return members
      .filter((m) => m.displayName.toLowerCase().includes(mentionFilter))
      .slice(0, 5);
  }, [members, mentionFilter]);

  const isSendingRef = useRef(false);

  // Send Message Handler
  const handleSendMessage = async () => {
    if (isSendingRef.current || isPending) return;
    const trimmed = inputText.trim();
    if (!trimmed && !attachmentUrl) return;

    if (!initialAcceptedRules && showRulesModal) {
      setShowRulesModal(true);
      return;
    }

    isSendingRef.current = true;
    setErrorMessage(null);

    // Client UUID for deduplication & idempotency
    const clientMessageId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `cid-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Optimistic Message with "sending" state
    const optimisticMessage: CommunityMessage = {
      id: clientMessageId,
      authorId: currentUser.id,
      authorName: currentUser.fullName || "Moi",
      authorRole: currentUser.role,
      authorAvatarUrl: null,
      body: trimmed,
      attachmentUrl,
      replyToId: replyingTo?.id || null,
      replyPreview: replyingTo
        ? {
            id: replyingTo.id,
            authorName: replyingTo.authorName,
            body: replyingTo.body,
          }
        : null,
      pinned: false,
      pinnedAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      reactions: [],
      isOptimistic: true,
      clientMessageId,
    } as any;

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputText("");
    setReplyingTo(null);
    setAttachmentUrl(null);
    setShowEmojiPicker(false);

    // Scroll to bottom immediately
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);

    // Execute server action
    startTransition(async () => {
      try {
        const res = await postMessageAction(
          trimmed,
          replyingTo?.id,
          attachmentUrl,
          clientMessageId,
          locale
        );
        if (!res.success) {
          setErrorMessage(res.error || "Impossible d'envoyer le message.");
          // Mark optimistic message as failed
          setMessages((prev) =>
            prev.map((m) =>
              m.id === clientMessageId
                ? { ...m, failedToSend: true, errorMessage: res.error }
                : m
            )
          );
        } else if (res.data) {
          // Confirm message
          setMessages((prev) =>
            prev.map((m) =>
              m.id === clientMessageId || (m as any).clientMessageId === clientMessageId
                ? { ...res.data!, isOptimistic: false }
                : m
            )
          );
        }
      } finally {
        isSendingRef.current = false;
      }
    });
  };

  // Retry sending failed message
  const handleRetryMessage = async (msg: CommunityMessage) => {
    setErrorMessage(null);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id ? { ...m, failedToSend: false, isOptimistic: true } : m
      )
    );
    const clientMessageId = (msg as any).clientMessageId || msg.id;
    const res = await postMessageAction(
      msg.body,
      msg.replyToId,
      msg.attachmentUrl,
      clientMessageId,
      locale
    );
    if (!res.success) {
      setErrorMessage(res.error || "Échec du renvoi.");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, failedToSend: true, errorMessage: res.error } : m
        )
      );
    } else if (res.data) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id || (m as any).clientMessageId === clientMessageId
            ? { ...res.data!, isOptimistic: false }
            : m
        )
      );
    }
  };

  // Toggle Reaction Handler
  const handleReaction = async (messageId: string, emoji: string) => {
    // Optimistic UI reaction update
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const existing = m.reactions.find((r) => r.emoji === emoji);
        let updatedReactions;
        if (existing) {
          if (existing.userReacted) {
            updatedReactions = m.reactions
              .map((r) => (r.emoji === emoji ? { ...r, count: Math.max(0, r.count - 1), userReacted: false } : r))
              .filter((r) => r.count > 0);
          } else {
            updatedReactions = m.reactions.map((r) =>
              r.emoji === emoji ? { ...r, count: r.count + 1, userReacted: true } : r
            );
          }
        } else {
          updatedReactions = [...m.reactions, { emoji, count: 1, userReacted: true }];
        }
        return { ...m, reactions: updatedReactions };
      })
    );

    await toggleReactionAction(messageId, emoji);
  };

  // Pin/Unpin Handler
  const handleTogglePin = async (msg: CommunityMessage) => {
    const targetState = !msg.pinned;
    setMessages((prev) =>
      prev.map((m) => ({
        ...m,
        pinned: m.id === msg.id ? targetState : false,
      }))
    );
    if (targetState) {
      setPinnedMessage({ ...msg, pinned: true });
      setPinnedBannerDismissed(false);
    } else {
      setPinnedMessage(null);
    }

    await pinMessageAction(msg.id, targetState);
  };

  // Delete Message Handler
  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Voulez-vous vraiment supprimer ce message ?")) return;

    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    if (pinnedMessage?.id === messageId) {
      setPinnedMessage(null);
    }
    await deleteMessageAction(messageId);
  };

  // Moderation Handler
  const handleModerateUser = async () => {
    if (!moderatingUser) return;
    await moderateUserAction(moderatingUser.id, moderationAction);
    alert(`L'action de modération (${moderationAction}) a été appliquée à ${moderatingUser.name}.`);
    setModeratingUser(null);
  };

  // Report Handler
  const handleReportSubmit = async () => {
    if (!reportingMessage) return;
    await reportMessageAction(reportingMessage.id, reportReason);
    setReportSuccess(true);
    setTimeout(() => {
      setReportingMessage(null);
      setReportSuccess(false);
    }, 1500);
  };

  // Image upload handling (< 3MB, jpg, png, webp)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setUploadError("Format invalide. Seuls les fichiers JPG, PNG et WEBP sont acceptés.");
      return;
    }

    const maxSize = 3 * 1024 * 1024; // 3MB
    if (file.size > maxSize) {
      setUploadError("L'image ne doit pas dépasser 3 Mo.");
      return;
    }

    // Convert to temporary local preview URL
    const reader = new FileReader();
    reader.onload = () => {
      setAttachmentUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Accept Rules Handler
  const handleAcceptRules = async () => {
    await acceptCommunityRulesAction();
    setShowRulesModal(false);
  };

  return (
    <div className="relative flex h-full w-full gap-4 md:gap-5 overflow-hidden bg-transparent">
      {/* ========================================================================= */}
      {/* 1. LEFT PANEL: DISCUSSIONS LIST & GROUP SUMMARY                           */}
      {/* ========================================================================= */}
      <aside
        className={`w-full md:w-[380px] lg:w-[410px] shrink-0 rounded-[20px] bg-white border border-line/60 shadow-sm flex flex-col justify-between overflow-hidden p-5 transition-transform duration-200 ${
          mobileView === "list" ? "flex" : "hidden md:flex"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header Row */}
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-navy-deep text-white flex items-center justify-center shrink-0 shadow-xs">
                <Users className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-heading font-bold text-ink leading-tight">
                  Communauté
                </h2>
                <p className="text-xs text-muted-faro mt-0.5 truncate">
                  Discussions de la communauté Faro School
                </p>
              </div>
            </div>

            {/* Pill Search Field */}
            <div className="relative mt-4">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-muted-faro" />
              <input
                type="text"
                placeholder="Rechercher dans la communauté..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-full bg-slate-panel border-0 text-xs text-ink placeholder:text-muted-faro focus:outline-none focus:bg-white focus:ring-2 focus:ring-orange/30 transition-all"
              />
            </div>
          </div>

          {/* Group Conversation Card (WhatsApp Style) */}
          <div className="mt-4">
            <button
              onClick={() => setMobileView("chat")}
              className="w-full text-left p-3.5 rounded-2xl bg-blue-tint border border-blue/20 shadow-2xs flex items-center gap-3 transition-colors hover:bg-blue-tint/80"
            >
              {/* Group Avatar */}
              <div className="relative shrink-0 w-11 h-11 rounded-full bg-navy-deep flex items-center justify-center text-white shadow-xs">
                <Users className="w-5 h-5" />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-ok border-2 border-surface rounded-full" />
              </div>

              {/* Title, Snippet & Badge */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-heading font-bold text-sm text-ink truncate">
                      {groupInfo.name}
                    </span>
                    <Pin className="w-3.5 h-3.5 text-orange shrink-0 fill-orange" />
                  </div>
                  <span className="text-[11px] font-medium text-muted-faro shrink-0">
                    {groupInfo.lastMessageTime}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className="text-xs text-muted-faro truncate max-w-[190px]">
                    {messages.length > 0
                      ? `${messages[messages.length - 1].authorName}: ${messages[messages.length - 1].body}`
                      : groupInfo.lastMessageSnippet}
                  </p>
                  {unreadCount > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-orange text-white text-[11px] font-bold shadow-xs shrink-0">
                      {unreadCount}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          </div>

          {/* Center Informational State */}
          <div className="flex-1 flex flex-col items-center justify-center py-6 text-center text-muted-faro">
            <div className="w-20 h-20 rounded-full bg-blue-tint text-navy-deep flex items-center justify-center mb-3 shadow-2xs mx-auto">
              <Users className="w-8 h-8 text-navy-deep" />
            </div>
            <h3 className="text-base font-heading font-bold text-ink">
              Une seule conversation de groupe
            </h3>
            <p className="text-xs text-muted-faro mt-1 max-w-[240px] leading-relaxed mx-auto">
              Échangez, posez vos questions et apprenez avec toute la communauté Faro School.
            </p>
          </div>

          {/* Bottom Info Note Card */}
          <div className="p-4 rounded-2xl bg-blue-tint border border-blue/10 flex items-start gap-3 mt-auto">
            <div className="w-5 h-5 rounded-full bg-blue text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-2xs">
              i
            </div>
            <p className="text-xs text-navy font-medium leading-relaxed">
              <span className="font-bold">Note :</span> Les étudiants discutent ensemble dans ce groupe. Pour un échange privé, cliquez sur « Contacter le formateur ».
            </p>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. RIGHT PANEL: CHAT WINDOW                                              */}
      {/* ========================================================================= */}
      <section
        className={`flex-1 flex flex-col h-full rounded-[20px] bg-white border border-line/60 shadow-sm relative overflow-hidden ${
          mobileView === "chat" ? "flex" : "hidden md:flex"
        }`}
      >
        {/* Offline / Connection Banner (Slim 32px strip, shown ONLY after lost for > 3s) */}
        {showConnectionLostBanner && (
          <div
            role="status"
            className="shrink-0 h-8 px-4 bg-amber-100 text-amber-900 border-b border-amber-200 text-xs flex items-center justify-center gap-2 select-none z-20"
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span className="truncate">
              {locale === "ht"
                ? "Koneksyon an koupe... Nouvo mesaj yo ap parèt otomatikman lè koneksyon an retounen."
                : "Connexion interrompue... Les nouveaux messages apparaîtront dès le rétablissement."}
            </span>
          </div>
        )}

        {/* Chat Header (56px high per Mobile Chat Spec) */}
        <header className="shrink-0 h-14 px-2 sm:px-4 md:px-6 border-b border-line/60 bg-white flex items-center justify-between gap-1.5 md:gap-3 shadow-subtle z-10 select-none">
          <div className="flex items-center gap-1.5 md:gap-3 min-w-0 flex-1">
            {/* Mobile Back Button (44px min tap target) */}
            <button
              onClick={() => setMobileView("list")}
              className="md:hidden min-h-[44px] min-w-[36px] p-1.5 rounded-lg text-muted-faro hover:text-ink hover:bg-bg shrink-0 flex items-center justify-center"
              aria-label="Retour à la liste"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* 36px Group Avatar */}
            <div className="relative shrink-0 w-9 h-9 rounded-full bg-navy-deep text-white flex items-center justify-center shadow-xs">
              <Users className="w-4 h-4" />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-ok border-2 border-white rounded-full" />
            </div>

            {/* Group Title and Info (Single line, takes the space it needs) */}
            <div className="min-w-0 flex-1">
              <h1 className="font-heading font-bold text-[13px] sm:text-base text-ink truncate leading-tight">
                <span className="hidden sm:inline">{groupInfo.name}</span>
                <span className="sm:hidden">Communauté</span>
              </h1>
              <p className="text-xs text-muted-faro leading-none mt-1 truncate">
                {formatNumber(groupInfo.totalMembersCount, locale)} membres
                <span className="hidden sm:inline text-muted-faro/60"> · Communauté officielle</span>
              </p>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Compact labeled button "Formateur" with cap icon (44px high tap target) */}
            <Link
              href="/dashboard/messages"
              className="inline-flex items-center gap-1 px-2 sm:px-3 min-h-[44px] h-9 sm:h-10 rounded-full border border-orange text-orange hover:bg-orange/5 text-[11px] sm:text-xs font-heading font-semibold transition-colors shadow-xs shrink-0"
              title="Contacter le formateur"
            >
              <GraduationCap className="w-4 h-4 text-orange shrink-0" />
              <span className="font-semibold">Formateur</span>
            </Link>

            {/* Menu (⋮) holding search and info */}
            <div className="relative">
              <button
                onClick={() => setIsMenuDropdownOpen(!isMenuDropdownOpen)}
                className="min-h-[44px] min-w-[36px] w-9 h-9 rounded-full border border-line/80 text-muted-faro hover:text-ink hover:bg-slate-50 flex items-center justify-center transition-colors"
                title="Options"
                aria-label="Plus d'options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {isMenuDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsMenuDropdownOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-surface border border-line shadow-card py-1 z-50 animate-in fade-in zoom-in-95">
                    <button
                      onClick={() => {
                        setIsSearchOpen(true);
                        setIsMenuDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-ink hover:bg-bg transition-colors text-left"
                    >
                      <Search className="w-4 h-4 text-muted-faro" />
                      <span>Rechercher</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowRulesModal(true);
                        setIsMenuDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-ink hover:bg-bg transition-colors text-left"
                    >
                      <Info className="w-4 h-4 text-muted-faro" />
                      <span>Règles de la communauté</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Chat Search Bar Expandable */}
        {isSearchOpen && (
          <div className="p-2 border-b border-line bg-surface/95 backdrop-blur flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-faro ml-2" />
            <input
              type="text"
              autoFocus
              placeholder="Rechercher un mot, un membre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 py-1 px-2 text-xs bg-transparent focus:outline-none text-ink"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="p-1 rounded-full text-muted-faro hover:text-ink"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Pinned Message Sticky Banner (1 line with ellipsis, expandable with chevron) */}
        {pinnedMessage && !pinnedBannerDismissed && (
          <div className="shrink-0 bg-blue-tint border-b border-blue/10 px-3 sm:px-4 py-1.5 flex items-center justify-between gap-2 shadow-2xs z-10 select-none">
            <button
              onClick={() => setIsPinnedExpanded(!isPinnedExpanded)}
              className="flex items-center gap-2 min-w-0 flex-1 text-left focus:outline-none"
              title="Cliquer pour afficher tout le message épinglé"
            >
              <Pin className="w-3.5 h-3.5 text-orange fill-orange shrink-0" />
              <div className="min-w-0 text-xs flex-1 flex items-center gap-1.5">
                <span className="font-heading font-bold text-navy shrink-0">
                  Épinglé :
                </span>
                <span
                  className={`text-navy ${
                    isPinnedExpanded ? "whitespace-pre-wrap block" : "truncate inline"
                  }`}
                >
                  {pinnedMessage.body}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-muted-faro shrink-0 transition-transform ${
                  isPinnedExpanded ? "rotate-180" : ""
                }`}
              />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPinnedBannerDismissed(true);
              }}
              className="text-muted-faro hover:text-ink p-1 rounded-full hover:bg-blue/10 shrink-0"
              title="Masquer le message épinglé"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Message Stream */}
        <div
          ref={chatScrollContainerRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 focus-visible:outline-none bg-chat-bg bg-[radial-gradient(#E2E8F0_1px,transparent_1px)] [background-size:20px_20px]"
        >
          {/* Messages list */}
          {displayedMessages.map((msg, idx) => {
            const isOwn = msg.authorId === currentUser.id;
            const isAdmin = msg.authorRole === "admin";
            const isInstructor = msg.authorRole === "instructor";
            const canPin = currentUser.role === "admin" || currentUser.role === "instructor";
            const canModerate = currentUser.role === "admin";
            const canDelete =
              currentUser.role === "admin" ||
              (isOwn && Date.now() - new Date(msg.createdAt).getTime() <= 5 * 60 * 1000);

            const authorColorClass = getAuthorColorClass(msg.authorId || msg.authorName);

            const msgDate = new Date(msg.createdAt).toDateString();
            const prevMsg = idx > 0 ? displayedMessages[idx - 1] : null;
            const prevDate = prevMsg ? new Date(prevMsg.createdAt).toDateString() : null;
            const isNewDay = idx === 0 || msgDate !== prevDate;

            const isSameAuthorAsPrev =
              !isNewDay &&
              prevMsg !== null &&
              prevMsg.authorId === msg.authorId &&
              Math.abs(new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) < 5 * 60 * 1000;

            const displayName = (isOwn ? currentUser.fullName : msg.authorName)
              .replace(/\s*\(Formateur\)/gi, "")
              .replace(/\s*\(Admin\)/gi, "")
              .trim();

            const initials = displayName
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0])
              .join("")
              .toUpperCase() || "U";

            const memberInfo = {
              id: msg.authorId,
              displayName,
              role: msg.authorRole,
              avatarUrl: msg.authorAvatarUrl,
            };

            return (
              <Fragment key={msg.id}>
                {/* Day Separator */}
                {isNewDay && (
                  <div className="flex items-center justify-center my-2.5 select-none">
                    <span className="px-3 py-0.5 rounded-full bg-white border border-line/60 text-[11px] font-semibold text-muted-faro shadow-2xs">
                      {formatDateSeparator(msg.createdAt, locale)}
                    </span>
                  </div>
                )}

                <div
                  className={`flex gap-2 group items-start ${
                    isOwn ? "justify-end" : "justify-start"
                  } ${isSameAuthorAsPrev ? "mt-1" : "mt-2"}`}
                >
                  {/* Avatar for other members: top-aligned 32px circle, clickable to view profile / message */}
                  {!isOwn && (
                    <>
                      {!isSameAuthorAsPrev ? (
                        <button
                          type="button"
                          onClick={() => setSelectedMemberProfile(memberInfo)}
                          className="w-8 h-8 rounded-full bg-navy-deep text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs select-none hover:ring-2 hover:ring-orange/50 transition-all focus:outline-none"
                          title={`Voir le profil de ${displayName}`}
                        >
                          {initials}
                        </button>
                      ) : (
                        <div className="w-8 shrink-0" aria-hidden="true" />
                      )}
                    </>
                  )}

                  {/* Message Bubble Container (85% on mobile, 65% on desktop) */}
                  <div
                    className={`flex flex-col max-w-[85%] sm:max-w-[75%] md:max-w-[65%] ${
                      isOwn ? "items-end" : "items-start"
                    }`}
                  >
                    {/* Bubble with 10px 12px padding */}
                    <div
                      className={`relative px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-2xl shadow-2xs transition-all ${
                        isOwn
                          ? "bg-chat-bubble-own border border-ok/20 rounded-tr-sm text-ink"
                          : "bg-white border border-line/50 rounded-tl-sm text-ink"
                      } ${msg.pinned ? "ring-2 ring-orange/60 shadow-orange" : ""}`}
                    >
                      {/* Author Name and Role Badges (only on first message of consecutive group) */}
                      {!isSameAuthorAsPrev && (
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          {isOwn ? (
                            <span className="text-[13px] font-heading font-semibold text-ok">
                              {currentUser.fullName}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedMemberProfile(memberInfo)}
                              className={`text-[13px] font-heading font-semibold hover:underline text-left focus:outline-none ${authorColorClass}`}
                              title={`Voir le profil de ${displayName}`}
                            >
                              {displayName}
                            </button>
                          )}

                          {!isOwn && isInstructor && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue fill-blue text-white shrink-0" />
                          )}

                          {!isOwn && isAdmin && (
                            <span className="px-1.5 py-0.2 rounded-full bg-orange text-white text-[10px] font-bold uppercase tracking-wider shadow-2xs">
                              ADMIN
                            </span>
                          )}

                          {!isOwn && isInstructor && (
                            <span className="px-1.5 py-0.2 rounded-full bg-orange text-white text-[10px] font-bold uppercase tracking-wider shadow-2xs">
                              FORMATEUR
                            </span>
                          )}
                        </div>
                      )}

                      {/* Pinned Marker inside bubble if pinned */}
                      {msg.pinned && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-orange mb-1">
                          <Pin className="w-3 h-3 fill-orange" />
                          <span>Message épinglé</span>
                        </div>
                      )}

                      {/* Reply Preview if this is a response */}
                      {msg.replyPreview && (
                        <div className="mb-2 p-2 rounded-lg bg-black/5 border-l-4 border-orange text-xs text-muted-faro">
                          <span className="font-bold text-ink block">
                            {msg.replyPreview.authorName}
                          </span>
                          <p className="line-clamp-2">{msg.replyPreview.body}</p>
                        </div>
                      )}

                      {/* Image Attachment */}
                      {msg.attachmentUrl && (
                        <div className="mb-2 overflow-hidden rounded-xl border border-line">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={msg.attachmentUrl}
                            alt="Pièce jointe"
                            className="max-h-60 w-auto object-cover rounded-xl"
                          />
                        </div>
                      )}

                      {/* Body text with mentions highlighted in green */}
                      <div className="text-[15px] leading-[1.45] whitespace-pre-wrap break-words">
                        {msg.body.split(/(@[a-zA-Z0-9_\u00C0-\u017F\-]+(?:\s+[a-zA-Z0-9_\u00C0-\u017F\-\.]+)?)/g).map((part, idx) => {
                          if (part.startsWith("@")) {
                            return (
                              <span key={idx} className="font-semibold text-ok bg-ok-tint px-1 py-0.5 rounded">
                                {part}
                              </span>
                            );
                          }
                          return part;
                        })}
                      </div>

                      {/* Timestamp & Status indicators */}
                      <div className="flex items-center justify-end gap-1 mt-1 text-[11px] text-muted-faro select-none">
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>

                        {isOwn && (
                          <>
                            {msg.failedToSend ? (
                              <button
                                onClick={() => handleRetryMessage(msg)}
                                className="text-red flex items-center gap-0.5 ml-1 hover:underline"
                                title="Échec de l'envoi. Cliquez pour réessayer."
                              >
                                <AlertCircle className="w-3 h-3 text-red" />
                                <RotateCcw className="w-3 h-3 text-red" />
                              </button>
                            ) : msg.isOptimistic ? (
                              <Clock className="w-3 h-3 text-muted-faro ml-1" />
                            ) : (
                              <span className="text-ok font-bold text-xs ml-1 flex items-center" title="Distribué">
                                <CheckCheck className="w-3.5 h-3.5 text-ok stroke-[2.5]" />
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Reactions Pills Bar: small pills under bubble */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 px-1">
                        {msg.reactions.map((r) => (
                          <button
                            key={r.emoji}
                            onClick={() => handleReaction(msg.id, r.emoji)}
                            className={`h-6 min-h-[24px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all ${
                              r.userReacted
                                ? "bg-orange-tint border-orange text-orange font-bold shadow-2xs"
                                : "bg-white border-line/60 text-ink hover:bg-slate-50 shadow-2xs"
                            }`}
                          >
                            <span className="text-xs">{r.emoji}</span>
                            <span className="text-[11px] font-medium">{r.count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                  {/* Hover Actions Bar */}
                  <div
                    className={`flex items-center gap-1 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                      isOwn ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    {/* Quick Reactions */}
                    <div className="flex items-center gap-0.5 bg-white border border-line/60 rounded-full px-1.5 py-0.5 shadow-xs">
                      {["👍", "❤️", "👏", "🔥", "🚀"].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(msg.id, emoji)}
                          className="hover:scale-125 transition-transform px-0.5 text-xs"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    {/* Reply Button */}
                    <button
                      onClick={() => {
                        setReplyingTo(msg);
                        textareaRef.current?.focus();
                      }}
                      className="p-1 rounded-full text-muted-faro hover:text-ink hover:bg-white border border-line/40 shadow-2xs"
                      title="Répondre"
                    >
                      <CornerUpLeft className="w-3.5 h-3.5" />
                    </button>

                    {/* Pin/Unpin (Admin/Instructor) */}
                    {canPin && (
                      <button
                        onClick={() => handleTogglePin(msg)}
                        className={`p-1 rounded-full border border-line/40 shadow-2xs ${
                          msg.pinned ? "text-orange fill-orange" : "text-muted-faro hover:text-orange hover:bg-white"
                        }`}
                        title={msg.pinned ? "Désépingler" : "Épingler le message"}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete Message */}
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="p-1 rounded-full text-muted-faro hover:text-red hover:bg-white border border-line/40 shadow-2xs"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Report Message */}
                    {!isOwn && (
                      <button
                        onClick={() => setReportingMessage(msg)}
                        className="p-1 rounded-full text-muted-faro hover:text-red hover:bg-white border border-line/40 shadow-2xs"
                        title="Signaler ce message"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Admin Moderation Button */}
                    {canModerate && !isOwn && (
                      <button
                        onClick={() => setModeratingUser({ id: msg.authorId, name: msg.authorName })}
                        className="p-1 rounded-full text-muted-faro hover:text-orange hover:bg-white border border-line/40 shadow-2xs"
                        title="Modérer l'utilisateur"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {/* Close Hover Actions Bar */}
                  </div>
                  {/* Close Message Bubble Container */}
                </div>
                {/* Close Outer Message Container */}
              </div>
            </Fragment>
          );
        })}
          <div ref={messagesEndRef} />
        </div>

        {/* Global Error Alert Banner */}
        {errorMessage && (
          <div className="mx-4 mb-2 p-2.5 rounded-xl bg-red-tint border border-red text-red text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-red/10 rounded-full">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. COMPOSER BAR (Mockup Polish)                                           */}
        {/* ========================================================================= */}
        <footer className="shrink-0 bg-white border-t border-line/60 px-3 sm:px-5 py-2.5 sm:py-3.5 relative">
          {/* Replying Banner */}
          {replyingTo && (
            <div className="mb-2 p-2 rounded-xl bg-orange-tint/70 border border-orange/30 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <CornerUpLeft className="w-4 h-4 text-orange shrink-0" />
                <div className="truncate">
                  <span className="font-bold text-ink mr-1">En réponse à {replyingTo.authorName} :</span>
                  <span className="text-muted-faro truncate">{replyingTo.body}</span>
                </div>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                className="p-1 text-muted-faro hover:text-ink rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Attachment Preview Banner */}
          {attachmentUrl && (
            <div className="mb-2 p-2 rounded-xl bg-bg border border-line flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={attachmentUrl} alt="Preview" className="w-12 h-12 object-cover rounded-lg" />
                <span className="text-xs text-ink font-medium">Image jointe prête à l&apos;envoi</span>
              </div>
              <button
                onClick={() => setAttachmentUrl(null)}
                className="p-1 text-muted-faro hover:text-ink rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {uploadError && (
            <div className="mb-2 text-xs text-red font-medium flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Mentions Autocomplete Popover */}
          {filteredMembersForMention.length > 0 && (
            <div className="absolute bottom-16 left-12 w-64 bg-surface border border-line rounded-xl shadow-card overflow-hidden z-20">
              <div className="p-2 border-b border-line text-[11px] font-bold text-muted-faro uppercase">
                Mentionner un membre
              </div>
              <div className="max-h-40 overflow-y-auto">
                {filteredMembersForMention.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => handleSelectMention(member)}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 text-xs hover:bg-orange-tint/40 transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full bg-navy-deep text-white flex items-center justify-center text-[10px] font-bold">
                      {member.displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-semibold text-ink">{member.displayName}</span>
                    <span className="text-[10px] text-muted-faro ml-auto">{member.role}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Emoji Picker Popover */}
          {showEmojiPicker && (
            <div className="absolute bottom-16 left-4 bg-surface border border-line rounded-2xl shadow-card p-3 grid grid-cols-4 sm:grid-cols-8 gap-2 z-20">
              {COMMON_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    setInputText((prev) => prev + emoji);
                    setShowEmojiPicker(false);
                    textareaRef.current?.focus();
                  }}
                  className="w-8 h-8 flex items-center justify-center text-lg hover:bg-bg rounded-lg transition-transform active:scale-95"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Floating New Messages Chip */}
          {showNewMessagesChip && (
            <button
              onClick={() => {
                setShowNewMessagesChip(false);
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
              }}
              className="absolute -top-12 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-full bg-navy-deep text-white text-xs font-heading font-bold shadow-lg flex items-center gap-1.5 animate-bounce hover:bg-navy transition-all select-none"
            >
              <span>{locale === "ht" ? "Nouvo mesaj ↓" : "Nouveaux messages ↓"}</span>
            </button>
          )}

          {/* Composer Row (Flex row, flexible input min-w-0, 44px round orange send button always fully visible) */}
          <div className="flex items-center gap-2 w-full">
            {/* Attachment Button (+ Icon in circle) */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 rounded-full border border-line/80 flex items-center justify-center text-muted-faro hover:text-ink hover:bg-slate-50 transition-colors shrink-0"
              title="Joindre une image (JPG, PNG, WEBP max 3 Mo)"
              aria-label="Joindre une image"
            >
              <Plus className="w-5 h-5" />
            </button>

            {/* Pill Input Container */}
            <div className="flex-1 min-w-0 bg-slate-panel rounded-full px-3.5 py-1.5 flex items-center gap-2 border border-transparent focus-within:border-orange/40 focus-within:bg-white focus-within:ring-2 focus-within:ring-orange/20 transition-all">
              <input
                ref={textareaRef as any}
                type="text"
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={locale === "ht" ? "Ekri yon mesaj..." : "Écrivez un message..."}
                className="bg-transparent border-0 text-xs sm:text-sm text-ink placeholder:text-muted-faro focus:outline-none flex-1 min-w-0 py-1 leading-normal"
              />

              {/* Emoji Button inside pill */}
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-1 rounded-full text-muted-faro hover:text-ink transition-colors shrink-0"
                title="Ajouter un émoji"
                aria-label="Ajouter un émoji"
              >
                <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Voice Mic icon (disabled with tooltip per mockup) */}
              <button
                type="button"
                disabled
                className="p-1 rounded-full text-muted-faro hover:text-ink cursor-not-allowed opacity-60 shrink-0"
                title="Messages vocaux bientôt disponibles"
                aria-label="Messages vocaux bientôt disponibles"
              >
                <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Round 44px Send Button: Always fully visible, never clipped, safe area respected */}
            <button
              onClick={handleSendMessage}
              disabled={isPending || (!inputText.trim() && !attachmentUrl)}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-orange hover:bg-orange-hover text-white shadow-orange flex items-center justify-center shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              title="Envoyer le message"
              aria-label="Envoyer"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Send className="w-4 h-4 ml-0.5 fill-current" />
              )}
            </button>
          </div>
        </footer>
      </section>

      {/* ========================================================================= */}
      {/* 4. MODALS: MEMBER PROFILE (DM), RULES, REPORT & ADMIN MODERATION           */}
      {/* ========================================================================= */}

      {/* Member Profile Modal with "Message privé" Action */}
      {selectedMemberProfile && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-2xl max-w-sm w-full p-5 shadow-card space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <h3 className="font-heading font-bold text-sm text-ink">
                {locale === "ht" ? "Pwofil manm" : "Profil du membre"}
              </h3>
              <button
                onClick={() => setSelectedMemberProfile(null)}
                className="p-1 text-muted-faro hover:text-ink rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-navy-deep text-white font-bold text-base flex items-center justify-center shrink-0 shadow-subtle select-none">
                {selectedMemberProfile.displayName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h4 className="font-heading font-bold text-base text-ink leading-tight">
                  {selectedMemberProfile.displayName}
                </h4>
                <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-muted-faro uppercase mt-1">
                  {selectedMemberProfile.role === "instructor"
                    ? "Formateur"
                    : selectedMemberProfile.role === "admin"
                    ? "Administrateur"
                    : "Étudiant"}
                </span>
              </div>
            </div>

            {/* Action: Message privé */}
            <div className="pt-2 border-t border-line">
              {currentUser.role === "instructor" && selectedMemberProfile.role === "student" ? (
                <p className="text-xs text-muted-faro text-center italic py-2">
                  {locale === "ht"
                    ? "Fòmatè yo ka sèlman reponn nan fil elèv la louvri."
                    : "Les formateurs peuvent uniquement répondre dans les fils ouverts par les élèves."}
                </p>
              ) : currentUser.id === selectedMemberProfile.id ? (
                <p className="text-xs text-muted-faro text-center italic py-2">
                  {locale === "ht" ? "Se pwofil ou." : "C'est votre profil."}
                </p>
              ) : currentUser.role === "student" && selectedMemberProfile.role === "student" ? (
                <p className="text-xs text-muted-faro text-center italic py-2">
                  {locale === "ht"
                    ? "Mesaj prive ant elèv yo pa otorize sou platfòm nan."
                    : "Les conversations privées entre élèves ne sont pas autorisées."}
                </p>
              ) : (
                <button
                  onClick={() => {
                    const targetUser = selectedMemberProfile;
                    setSelectedMemberProfile(null);
                    if (currentUser.role === "admin") {
                      router.push(
                        `/${locale}/admin/messages?studentId=${targetUser.id}&name=${encodeURIComponent(
                          targetUser.displayName
                        )}`
                      );
                    } else {
                      router.push(
                        `/${locale}/dashboard/messages?new=1&recipientId=${targetUser.id}&name=${encodeURIComponent(
                          targetUser.displayName
                        )}`
                      );
                    }
                  }}
                  className="w-full h-11 rounded-xl bg-orange hover:bg-orange-hover text-white font-heading font-bold text-xs sm:text-sm shadow-orange flex items-center justify-center gap-2 transition-all"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{locale === "ht" ? "Mesaj prive" : "Message privé"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rules Modal (First Visit) */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-2xl max-w-lg w-full p-6 shadow-card space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-tint flex items-center justify-center text-orange">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg text-ink">
                  Règles de la communauté Faro School
                </h3>
                <p className="text-xs text-muted-faro">
                  Veuillez lire et accepter les règles pour participer aux échanges.
                </p>
              </div>
            </div>

            <div className="space-y-3 py-2 text-xs text-ink/90 border-y border-line max-h-60 overflow-y-auto">
              <div className="flex items-start gap-2">
                <span className="font-bold text-orange shrink-0">1.</span>
                <p>
                  <strong className="text-ink">Respect et bienveillance :</strong> Tous les échanges doivent rester courtois et professionnels. Les insultes, le harcèlement et les propos discriminatoires sont strictement bannis.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-orange shrink-0">2.</span>
                <p>
                  <strong className="text-ink">Aucun spam ni démarchage :</strong> Les messages publicitaires, les liens pyramidaux, les schémas d&apos;enrichissement rapide et les offres tierces sont formellement interdits.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-orange shrink-0">3.</span>
                <p>
                  <strong className="text-ink">Protection de votre vie privée :</strong> Ne divulguez jamais vos codes PIN, numéros secrets MonCash/NatCash ou mots de passe personnels dans le groupe public.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-orange shrink-0">4.</span>
                <p>
                  <strong className="text-ink">Entraide pédagogique :</strong> Ce groupe est dédié à l&apos;apprentissage. Aidez vos camarades et partagez vos réussites sur les cours.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-orange shrink-0">5.</span>
                <p>
                  <strong className="text-ink">Langues autorisées :</strong> Le Français et le Kreyòl Ayisyen sont tous les deux les bienvenus avec la même courtoisie.
                </p>
              </div>
            </div>

            <label className="flex items-start gap-2 text-xs text-ink cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={rulesCheckboxChecked}
                onChange={(e) => setRulesCheckboxChecked(e.target.checked)}
                className="mt-0.5 rounded border-line text-orange focus:ring-orange"
              />
              <span>J&apos;ai lu attentivement et j&apos;accepte les règles de la communauté Faro School.</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleAcceptRules}
                disabled={!rulesCheckboxChecked}
                className={`w-full py-2.5 px-4 rounded-xl font-heading font-semibold text-xs text-white transition-all ${
                  rulesCheckboxChecked
                    ? "bg-orange hover:bg-orange-strong shadow-orange"
                    : "bg-orange/40 cursor-not-allowed"
                }`}
              >
                Accéder à la communauté
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportingMessage && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-2xl max-w-md w-full p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-red" />
                <h3 className="font-heading font-bold text-base text-ink">Signaler un message</h3>
              </div>
              <button onClick={() => setReportingMessage(null)} className="text-muted-faro hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>

            {reportSuccess ? (
              <div className="p-4 rounded-xl bg-ok-tint text-ok text-xs font-semibold text-center">
                Merci ! Ce message a été transmis à l&apos;équipe de modération.
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-faro">
                  Sélectionnez la raison du signalement pour le message de <strong>{reportingMessage.authorName}</strong> :
                </p>

                <div className="space-y-2 text-xs">
                  {[
                    "Spam ou message non sollicité",
                    "Propos injurieux, haineux ou harcèlement",
                    "Arnaque financière ou fausses promesses",
                    "Partage de données personnelles ou sensibles",
                    "Autre comportement inapproprié",
                  ].map((reason) => (
                    <label
                      key={reason}
                      className="flex items-center gap-2 p-2 rounded-xl border border-line hover:bg-bg cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="reportReason"
                        checked={reportReason === reason}
                        onChange={() => setReportReason(reason)}
                        className="text-orange focus:ring-orange"
                      />
                      <span className="text-ink">{reason}</span>
                    </label>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setReportingMessage(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-faro hover:bg-bg"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleReportSubmit}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-red text-white hover:bg-red/90"
                  >
                    Confirmer le signalement
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Admin Moderation Modal */}
      {moderatingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-2xl max-w-md w-full p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-orange" />
                <h3 className="font-heading font-bold text-base text-ink">
                  Modérer {moderatingUser.name}
                </h3>
              </div>
              <button onClick={() => setModeratingUser(null)} className="text-muted-faro hover:text-ink">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-faro">
              En tant qu&apos;administrateur, vous pouvez temporairement mettre cet utilisateur en sourdine ou le bannir de la communauté.
            </p>

            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 p-2 rounded-xl border border-line cursor-pointer hover:bg-bg">
                <input
                  type="radio"
                  name="moderation"
                  checked={moderationAction === "mute_1h"}
                  onChange={() => setModerationAction("mute_1h")}
                  className="text-orange focus:ring-orange"
                />
                <span className="text-ink">Mettre en sourdine pendant 1 heure</span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded-xl border border-line cursor-pointer hover:bg-bg">
                <input
                  type="radio"
                  name="moderation"
                  checked={moderationAction === "mute_24h"}
                  onChange={() => setModerationAction("mute_24h")}
                  className="text-orange focus:ring-orange"
                />
                <span className="text-ink">Mettre en sourdine pendant 24 heures</span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded-xl border border-line cursor-pointer hover:bg-bg">
                <input
                  type="radio"
                  name="moderation"
                  checked={moderationAction === "mute_7d"}
                  onChange={() => setModerationAction("mute_7d")}
                  className="text-orange focus:ring-orange"
                />
                <span className="text-ink">Mettre en sourdine pendant 7 jours</span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded-xl border border-line cursor-pointer hover:bg-red-tint border-red/40">
                <input
                  type="radio"
                  name="moderation"
                  checked={moderationAction === "ban"}
                  onChange={() => setModerationAction("ban")}
                  className="text-red focus:ring-red"
                />
                <span className="text-red font-bold">Bannir définitivement de la communauté</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setModeratingUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-faro hover:bg-bg"
              >
                Annuler
              </button>
              <button
                onClick={handleModerateUser}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-orange text-white hover:bg-orange-strong shadow-orange"
              >
                Appliquer la sanction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
