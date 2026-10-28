"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, MessageSquare, Send, BookOpen, AlertCircle, Loader2 } from "lucide-react";
import { createConversationAction } from "@/app/actions/private-messaging";
import type { EnrolledCourseOption } from "@/lib/messaging/types";

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  enrolledCourses: EnrolledCourseOption[];
  defaultCourseId?: string | null;
  locale: string;
}

export function NewConversationModal({
  isOpen,
  onClose,
  enrolledCourses,
  defaultCourseId,
  locale,
}: NewConversationModalProps) {
  const router = useRouter();
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    defaultCourseId || (enrolledCourses[0]?.id || "general")
  );
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const isHt = locale === "ht";

  // Find instructor for the selected course
  const selectedCourse = enrolledCourses.find((c) => c.id === selectedCourseId);
  const recipientName = selectedCourse
    ? selectedCourse.instructorName
    : "Support Administratif Faro School";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setErrorMessage(null);
    startTransition(async () => {
      const courseIdToSubmit = selectedCourseId === "general" ? null : selectedCourseId;
      const res = await createConversationAction(courseIdToSubmit, subject, message);

      if (!res.success) {
        setErrorMessage(res.error || "Impossible d'initier la conversation.");
      } else if (res.data?.conversationId) {
        onClose();
        router.push(`/${locale}/dashboard/messages/${res.data.conversationId}`);
        router.refresh();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-line rounded-2xl max-w-lg w-full p-6 shadow-card space-y-4 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-orange-tint text-orange flex items-center justify-center shadow-subtle">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-ink">
                {isHt ? "Kontakte fòmatè a" : "Contacter le formateur"}
              </h3>
              <p className="text-xs text-muted-faro">
                {isHt
                  ? "Voye yon mesaj prive bay fòmatè w la oswa ekip Faro a."
                  : "Échange privé et confidentiel avec votre formateur ou l'équipe Faro."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-muted-faro hover:text-ink hover:bg-bg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-tint border border-red text-red text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Course Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-heading font-semibold text-ink">
              {isHt ? "Chwazi fòmasyon an" : "Formation concernée"}
            </label>
            <div className="relative">
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full py-2.5 px-3.5 text-xs sm:text-sm rounded-xl bg-bg border border-line text-ink focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange/30 appearance-none transition-all cursor-pointer"
              >
                {enrolledCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} — ({c.instructorName})
                  </option>
                ))}
                <option value="general">
                  {isHt ? "Kesyon jeneral / Sipò Faro School (Admin)" : "Autre question / Support Faro School (Admin)"}
                </option>
              </select>
              <BookOpen className="w-4 h-4 text-muted-faro absolute right-3.5 top-3 pointer-events-none" />
            </div>
            <p className="text-[11px] text-muted-faro">
              {isHt ? "Destinatè" : "Destinataire"} : <strong className="text-ink">{recipientName}</strong>
            </p>
          </div>

          {/* Subject Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-heading font-semibold text-ink">
              {isHt ? "Sijè mesaj la" : "Sujet de votre question"}
            </label>
            <input
              type="text"
              required
              placeholder={isHt ? "Eg: Kesyon sou modil 2, difikilte pou aplike..." : "Ex: Question sur la leçon 3, blocage technique..."}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full py-2.5 px-3.5 text-xs sm:text-sm rounded-xl bg-bg border border-line text-ink placeholder:text-muted-faro focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange/30 transition-all"
            />
          </div>

          {/* Message Area */}
          <div className="space-y-1.5">
            <label className="block text-xs font-heading font-semibold text-ink">
              {isHt ? "Mesaj ou a" : "Votre message"}
            </label>
            <textarea
              required
              rows={4}
              placeholder={
                isHt
                  ? "Eksplike kesyon w lan klèman. Si fòmatè a pa an liy, asistan IA a oswa yon notifikasyon imèl ap pran relè a."
                  : "Expliquez précisément votre question. Si le formateur est hors-ligne, son assistant IA ou une alerte e-mail assurera le suivi."
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full py-2.5 px-3.5 text-xs sm:text-sm rounded-xl bg-bg border border-line text-ink placeholder:text-muted-faro focus:outline-none focus:border-orange focus:ring-1 focus:ring-orange/30 transition-all leading-normal resize-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2.5 rounded-xl text-xs font-heading font-semibold text-muted-faro hover:text-ink hover:bg-bg transition-colors"
            >
              {isHt ? "Anile" : "Annuler"}
            </button>
            <button
              type="submit"
              disabled={isPending || !subject.trim() || !message.trim()}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-heading font-semibold text-white transition-all shadow-orange ${
                isPending || !subject.trim() || !message.trim()
                  ? "bg-orange/40 cursor-not-allowed"
                  : "bg-orange hover:bg-orange-strong active:scale-95"
              }`}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{isHt ? "Ap voye..." : "Envoi en cours..."}</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{isHt ? "Voye bay fòmatè a" : "Envoyer au formateur"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
