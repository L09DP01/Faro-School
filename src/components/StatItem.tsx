import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatItemProps {
  icon?: ReactNode;
  value: string;
  label: string;
  className?: string;
}

export function StatItem({ icon, value, label, className }: StatItemProps) {
  return (
    <div className={cn("flex items-center gap-3.5 py-2 px-3 sm:px-6", className)}>
      {icon && (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-tint text-orange border border-orange/20">
          {icon}
        </div>
      )}
      <div className="flex flex-col">
        <span className="font-heading text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
          {value}
        </span>
        <span className="text-xs sm:text-sm font-medium text-muted-faro">
          {label}
        </span>
      </div>
    </div>
  );
}
