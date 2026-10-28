import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number; // 0 to 100
  className?: string;
  showLabel?: boolean;
}

export function ProgressBar({
  value,
  className,
  showLabel = false,
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {showLabel && (
        <div className="flex justify-between items-center text-xs font-semibold text-ink">
          <span>Progression</span>
          <span className="text-orange-strong font-bold">{clampedValue}%</span>
        </div>
      )}
      <div className="w-full h-2 bg-line rounded-full overflow-hidden">
        <div
          className="h-full bg-orange transition-all duration-300 ease-out rounded-full shadow-orange"
          style={{ width: `${clampedValue}%` }}
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}
