"use client";

import { useEffect } from "react";

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
}

export function VideoModal({ isOpen, onClose, title }: VideoModalProps) {
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
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
          <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Fermer la vidéo"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video container */}
        <div className="relative aspect-video w-full bg-black flex items-center justify-center text-center p-6">
          <div className="space-y-3">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-primary">
              <svg className="w-7 h-7 fill-current ml-0.5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-white">Vidéo de présentation Faro School</p>
            <p className="text-xs text-zinc-400 max-w-sm">
              Présentation des fonctionnalités, du catalogue et du mode de paiement par MonCash &amp; NatCash.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
