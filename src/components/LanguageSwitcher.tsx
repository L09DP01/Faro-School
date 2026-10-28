"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const currentLocale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const switchLocale = (nextLocale: "fr" | "ht") => {
    if (nextLocale === currentLocale) return;
    document.cookie = `faro_locale=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-muted/40 p-0.5 text-xs font-medium",
        className
      )}
      role="group"
      aria-label="Sélection de la langue"
    >
      <button
        type="button"
        onClick={() => switchLocale("fr")}
        disabled={isPending}
        className={cn(
          "px-2.5 py-1 rounded transition-colors",
          currentLocale === "fr"
            ? "bg-background text-foreground shadow-sm font-semibold"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-pressed={currentLocale === "fr"}
      >
        FR
      </button>
      <button
        type="button"
        onClick={() => switchLocale("ht")}
        disabled={isPending}
        title="Kreyòl Ayisyen"
        className={cn(
          "px-2.5 py-1 rounded transition-colors",
          currentLocale === "ht"
            ? "bg-background text-foreground shadow-sm font-semibold"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-pressed={currentLocale === "ht"}
      >
        KR
      </button>
    </div>
  );
}
