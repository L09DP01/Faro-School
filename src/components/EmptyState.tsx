import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  const t = useTranslations("common");

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-[20px] border border-line bg-surface shadow-card",
        className
      )}
    >
      {/* Small Icon Square */}
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-tint text-orange border border-orange/20 shadow-sm shrink-0">
        {icon || (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
      </div>

      <h3 className="font-heading text-lg font-bold text-ink">
        {title || t("empty")}
      </h3>

      {description && (
        <p className="mt-1.5 font-sans text-xs sm:text-sm text-muted-faro max-w-md leading-relaxed">
          {description}
        </p>
      )}

      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
