"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

interface LessonPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessonId: string | null;
  lessonTitle: string;
  courseSlug: string;
}

export function LessonPreviewModal({
  isOpen,
  onClose,
  lessonId,
  lessonTitle,
  courseSlug,
}: LessonPreviewModalProps) {
  const t = useTranslations("courseDetail.previewModal");
  const [loading, setLoading] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !lessonId) {
      setPlaybackUrl(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/video/playback?lessonId=${encodeURIComponent(lessonId)}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Accès refusé ou leçon verrouillée");
        }
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          if (data.playbackUrl) {
            setPlaybackUrl(data.playbackUrl);
          } else {
            setError(t("error"));
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || t("error"));
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, lessonId, t]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={lessonTitle || t("title")}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2 truncate pr-4">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-primary/10 text-primary">
              Aperçu gratuit
            </span>
            <h3 className="text-sm font-semibold text-foreground truncate">{lessonTitle}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label={t("close")}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video Player or Fallback */}
        <div className="relative aspect-video w-full bg-black flex items-center justify-center">
          {loading && (
            <div className="flex flex-col items-center gap-2 text-white">
              <span className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-zinc-300">{t("loading")}</p>
            </div>
          )}

          {!loading && error && (
            <div className="p-6 text-center text-white space-y-3">
              <p className="text-sm text-red-400 font-medium">{error}</p>
              <Link
                href={`/checkout/${courseSlug}`}
                className="inline-block px-4 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground"
              >
                {t("unlock")}
              </Link>
            </div>
          )}

          {!loading && !error && playbackUrl && (
            <video
              src={playbackUrl}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-3 bg-muted/30 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            Cet extrait gratuit vous donne un aperçu de la qualité pédagogique du cours.
          </p>
          <Link
            href={`/checkout/${courseSlug}`}
            onClick={onClose}
            className="shrink-0 px-4 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            {t("unlock")} →
          </Link>
        </div>
      </div>
    </div>
  );
}
