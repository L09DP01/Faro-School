import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({ label, className }: LoadingStateProps) {
  const t = useTranslations("common");

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center text-muted-foreground",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mb-3" />
      <span className="text-sm font-medium">{label || t("loading")}</span>
    </div>
  );
}
