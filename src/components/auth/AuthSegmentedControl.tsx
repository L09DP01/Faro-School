"use client";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface AuthSegmentedControlProps {
  activeTab: "login" | "register";
  nextParam?: string;
}

export function AuthSegmentedControl({ activeTab, nextParam }: AuthSegmentedControlProps) {
  const registerHref = nextParam
    ? `/inscription?next=${encodeURIComponent(nextParam)}`
    : "/inscription";
  const loginHref = nextParam
    ? `/connexion?next=${encodeURIComponent(nextParam)}`
    : "/connexion";

  return (
    <div className="grid grid-cols-2 p-1 rounded-xl bg-bg border border-line mb-5 shadow-inner select-none">
      <Link
        href={loginHref}
        className={cn(
          "py-2 px-3 rounded-lg font-heading text-xs sm:text-sm text-center transition-all duration-150 flex items-center justify-center",
          activeTab === "login"
            ? "bg-surface text-ink font-bold shadow-card border border-line/70"
            : "text-muted-faro hover:text-ink font-medium"
        )}
      >
        Se connecter
      </Link>
      <Link
        href={registerHref}
        className={cn(
          "py-2 px-3 rounded-lg font-heading text-xs sm:text-sm text-center transition-all duration-150 flex items-center justify-center",
          activeTab === "register"
            ? "bg-surface text-ink font-bold shadow-card border border-line/70"
            : "text-muted-faro hover:text-ink font-medium"
        )}
      >
        Créer un compte
      </Link>
    </div>
  );
}
