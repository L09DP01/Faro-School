"use client";

import { useState, useTransition, useEffect } from "react";
import type { ContactMessageItem, MessageFilterStatus } from "@/lib/admin/message-types";
import { toggleMessageReadAction, deleteMessageAction } from "@/app/actions/admin-messages";

interface AdminMessagesClientProps {
  initialMessages: ContactMessageItem[];
  locale: string;
}

export function AdminMessagesClient({ initialMessages, locale }: AdminMessagesClientProps) {
  const [messages, setMessages] = useState<ContactMessageItem[]>(initialMessages);
  const [filter, setFilter] = useState<MessageFilterStatus>("all");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ContactMessageItem | null>(null);
  const [isPending, startTransition] = useTransition();

  const isHt = locale === "ht";

  // Escape key handler
  useEffect(() => {
    if (!deleteTarget) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDeleteTarget(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteTarget]);

  // Filter messages
  const filteredMessages = messages.filter((m) => {
    // Status filter
    if (filter === "unread" && m.read) return false;
    if (filter === "read" && !m.read) return false;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchName = m.name.toLowerCase().includes(q);
      const matchContact = m.contact.toLowerCase().includes(q);
      const matchMsg = m.message.toLowerCase().includes(q);
      if (!matchName && !matchContact && !matchMsg) return false;
    }

    return true;
  });

  const unreadCount = messages.filter((m) => !m.read).length;
  const readCount = messages.filter((m) => m.read).length;

  const handleToggleRead = (m: ContactMessageItem) => {
    const nextRead = !m.read;
    startTransition(async () => {
      await toggleMessageReadAction(m.id, nextRead);
      setMessages((prev) =>
        prev.map((item) =>
          item.id === m.id
            ? { ...item, read: nextRead, readAt: nextRead ? new Date().toISOString() : null }
            : item
        )
      );
    });
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      await deleteMessageAction(deleteTarget.id);
      setMessages((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    });
  };

  // Helper to format WhatsApp link
  const getWhatsAppUrl = (contact: string, senderName: string) => {
    const digits = contact.replace(/\D/g, "");
    let fullNumber = digits;
    if (digits.length === 8) {
      fullNumber = `509${digits}`;
    }
    const greeting = isHt
      ? `Bonjou ${senderName}, mwen se yon responsab nan Faro School. Mwen resevwa mesaj ou a:`
      : `Bonjour ${senderName}, je vous contacte suite à votre message envoyé sur Faro School :`;
    return `https://wa.me/${fullNumber}?text=${encodeURIComponent(greeting)}`;
  };

  const isEmail = (contact: string) => contact.includes("@");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <nav aria-label="Fil d'Ariane" className="text-xs text-muted-faro flex items-center gap-1.5 mb-1.5">
            <span>Administration</span>
            <span aria-hidden="true">/</span>
            <span className="text-ink font-medium" aria-current="page">Messages</span>
          </nav>
          <h1 className="font-heading font-bold text-2xl sm:text-[30px] leading-tight text-ink">
            {isHt ? "Bwat Mesaj Kontak" : "Boîte de Réception & Support"}
          </h1>
          <p className="mt-1 text-sm text-muted-faro font-sans">
            {isHt
              ? "Gade tout mesaj elèv ak vizitè yo voye nan paj kontak la, epi reponn yo rapidman pa WhatsApp oswa imel."
              : "Consultez les messages reçus depuis la page contact et répondez directement aux apprenants via WhatsApp ou email."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-tint border border-blue/20 px-3 py-1 text-xs font-semibold text-blue">
            <span className="h-2 w-2 rounded-full bg-blue animate-pulse" />
            <span>{unreadCount} {isHt ? "mesaj ki pa li" : "non lus"}</span>
          </span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-[18px] border border-line bg-surface shadow-card">
        {/* Filter Pills */}
        <div className="inline-flex items-center p-1 bg-bg rounded-xl border border-line text-xs font-heading font-semibold">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue ${
              filter === "all"
                ? "bg-surface text-ink border border-line shadow-sm"
                : "text-muted-faro hover:text-ink"
            }`}
          >
            {isHt ? "Tout" : "Tous"} ({messages.length})
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`rounded-lg px-3.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue ${
              filter === "unread"
                ? "bg-blue-tint text-blue border border-blue/30 shadow-sm"
                : "text-muted-faro hover:text-ink"
            }`}
          >
            {isHt ? "Ki pa li" : "Non lus"} ({unreadCount})
          </button>
          <button
            onClick={() => setFilter("read")}
            className={`rounded-lg px-3.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue ${
              filter === "read"
                ? "bg-surface text-ink border border-line shadow-sm"
                : "text-muted-faro hover:text-ink"
            }`}
          >
            {isHt ? "Li deja" : "Lus"} ({readCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <svg className="w-4 h-4 text-muted-faro absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isHt ? "Chèche pa non, kontak..." : "Rechercher un message..."}
            aria-label={isHt ? "Chèche pa non, kontak" : "Rechercher un message"}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-line bg-bg text-ink placeholder:text-muted-faro focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-faro hover:text-ink"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Messages Cards List */}
      <div className="space-y-4">
        {filteredMessages.length === 0 ? (
          <div className="rounded-[18px] border border-line bg-surface p-12 text-center shadow-card space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-bg text-muted-faro border border-line">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="font-heading font-bold text-sm text-ink">
              {isHt ? "Pa gen okenn mesaj" : "Aucun message trouvé"}
            </h3>
            <p className="text-xs text-muted-faro font-sans">
              {isHt ? "Tout mesaj ou resevwa ap parèt isit la." : "Tous vos messages de contact s'afficheront ici."}
            </p>
          </div>
        ) : (
          filteredMessages.map((m) => {
            const hasPhone = !isEmail(m.contact);
            return (
              <div
                key={m.id}
                className={`rounded-[18px] border p-6 transition-all shadow-card space-y-4 ${
                  !m.read
                    ? "border-blue/40 bg-surface ring-1 ring-blue/20"
                    : "border-line bg-surface hover:border-line"
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        !m.read ? "bg-blue" : "bg-muted-faro/30"
                      }`}
                      title={!m.read ? (isHt ? "Mesaj ki pa li" : "Message non lu") : (isHt ? "Mesaj li" : "Message lu")}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-heading font-bold text-sm text-ink">
                          {m.name}
                        </h4>
                        {!m.read && (
                          <span className="rounded-full bg-blue-tint border border-blue/20 px-2 py-0.2 text-[10px] font-bold text-blue">
                            {isHt ? "NOUVO" : "NOUVEAU"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-muted-faro mt-0.5">
                        {m.contact}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-muted-faro font-mono">
                    {new Date(m.createdAt).toLocaleDateString(isHt ? "ht-HT" : "fr-FR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                {/* Message Body */}
                <div className="text-sm text-ink/90 whitespace-pre-line rounded-xl bg-bg p-4 border border-line leading-relaxed font-sans">
                  {m.message}
                </div>

                {/* Actions Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line/60">
                  <div className="flex items-center gap-2">
                    {/* WhatsApp button */}
                    {hasPhone && (
                      <a
                        href={getWhatsAppUrl(m.contact, m.name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-ok px-4 py-2 text-xs font-heading font-semibold text-white shadow-sm hover:bg-ok/90 transition-colors"
                      >
                        <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.669-.699c.969.54 1.772.814 2.791.814 3.182 0 5.768-2.587 5.768-5.766 0-3.179-2.586-5.766-5.768-5.766zm9.969 5.766c0 5.419-4.407 9.826-9.969 9.826-1.745 0-3.377-.45-4.814-1.238l-7.217 1.891 1.926-7.037c-.899-1.503-1.41-3.256-1.41-5.127 0-5.419 4.408-9.826 9.97-9.826 5.561 0 9.969 4.407 9.969 9.826z" />
                        </svg>
                        <span>{isHt ? "Reponn sou WhatsApp" : "Répondre sur WhatsApp"}</span>
                      </a>
                    )}

                    {/* Email button */}
                    {isEmail(m.contact) && (
                      <a
                        href={`mailto:${m.contact}?subject=${encodeURIComponent("Faro School - Réponse à votre message")}`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-heading font-semibold text-ink hover:bg-bg transition-colors"
                      >
                        <svg className="h-4 w-4 text-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span>{isHt ? "Reponn pa imel" : "Répondre par email"}</span>
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleRead(m)}
                      disabled={isPending}
                      className="px-3 py-1.5 rounded-lg border border-line text-xs font-semibold text-ink hover:bg-bg transition-colors"
                    >
                      {m.read ? (isHt ? "Mete kòm pa li" : "Marquer non lu") : isHt ? "Mete kòm li" : "Marquer comme lu"}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(m)}
                      className="px-3 py-1.5 rounded-lg border border-red/20 text-xs font-semibold text-red hover:bg-red-tint transition-colors"
                    >
                      {isHt ? "Efase" : "Supprimer"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-msg-title"
            className="w-full max-w-sm rounded-[18px] border border-line bg-surface p-7 shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-3 text-red">
              <div className="w-10 h-10 rounded-full bg-red-tint border border-red/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h2 id="delete-msg-title" className="font-heading font-bold text-base text-ink">
                {isHt ? "Efase mesaj sa a ?" : "Supprimer ce message ?"}
              </h2>
            </div>

            <p className="text-xs text-muted-faro font-sans leading-relaxed">
              {isHt
                ? `Èske ou vle efase mesaj ${deleteTarget.name} a ? Aksyon sa a pa ka defèt.`
                : `Êtes-vous sûr de vouloir supprimer définitivement le message de ${deleteTarget.name} ? Cette action est irréversible.`}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-line text-xs font-semibold text-ink hover:bg-bg transition-colors"
              >
                {isHt ? "Anile" : "Annuler"}
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isPending}
                className="px-5 py-2 rounded-xl bg-red text-white text-xs font-heading font-semibold hover:bg-red/90 transition-colors disabled:opacity-50 shadow-sm"
              >
                {isPending ? (isHt ? "N ap efase l..." : "Suppression...") : isHt ? "Konfime sipresyon" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
