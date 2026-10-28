import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-line/60 dark:bg-line/20",
        className
      )}
      aria-hidden="true"
    />
  );
}

/**
 * Card Skeleton (for course cards, stat cards, etc.)
 */
export function CardSkeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-[18px] border border-line bg-surface p-5 shadow-card space-y-4 animate-pulse",
        className
      )}
      role="status"
      aria-label="Chargement de la carte"
    >
      <div className="w-full aspect-video rounded-xl bg-line/60" />
      <div className="space-y-2 pt-1">
        <div className="h-4 w-3/4 rounded bg-line/60" />
        <div className="h-3 w-1/2 rounded bg-line/40" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-line/40">
        <div className="h-4 w-1/3 rounded bg-line/60" />
        <div className="h-8 w-24 rounded-lg bg-line/50" />
      </div>
    </div>
  );
}

/**
 * List / Row Skeleton (for student directory, curriculum lessons, messages)
 */
export function ListSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn("space-y-3", className)}
      role="status"
      aria-label="Chargement de la liste"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-line bg-surface p-4 flex items-center justify-between gap-4 animate-pulse shadow-sm"
        >
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-line/60 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-3.5 w-1/3 rounded bg-line/60" />
              <div className="h-3 w-1/4 rounded bg-line/40" />
            </div>
          </div>
          <div className="h-8 w-20 rounded-lg bg-line/50 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * Table Skeleton (for admin ledger tables)
 */
export function TableSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[18px] border border-line bg-surface shadow-card overflow-hidden animate-pulse",
        className
      )}
      role="status"
      aria-label="Chargement des données du tableau"
    >
      <div className="h-12 border-b border-line bg-bg/50 px-4 flex items-center gap-4">
        <div className="h-3.5 w-24 rounded bg-line/60" />
        <div className="h-3.5 w-32 rounded bg-line/50" />
        <div className="h-3.5 w-20 rounded bg-line/50 ml-auto" />
      </div>
      <div className="divide-y divide-line/60">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="h-14 px-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-line/50" />
              <div className="space-y-1.5">
                <div className="h-3 w-32 rounded bg-line/60" />
                <div className="h-2.5 w-20 rounded bg-line/40" />
              </div>
            </div>
            <div className="h-3 w-16 rounded bg-line/50" />
            <div className="h-6 w-20 rounded-full bg-line/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
