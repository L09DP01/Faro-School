import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title,
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  const t = useTranslations("common");

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-6 text-center rounded-lg border border-destructive/30 bg-destructive/5 text-destructive",
        className
      )}
      role="alert"
    >
      <h3 className="text-base font-semibold text-foreground">
        {title || t("error")}
      </h3>
      {message && (
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">
          {message}
        </p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 px-4 py-2 text-xs font-semibold rounded-md border border-border bg-background text-foreground hover:bg-muted transition-colors"
        >
          {t("retry")}
        </button>
      )}
    </div>
  );
}
