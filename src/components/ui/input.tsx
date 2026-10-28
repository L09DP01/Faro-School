import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, hint, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-semibold text-ink"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            id={inputId}
            type={type}
            ref={ref}
            className={cn(
              "flex w-full rounded-xl border-[1.5px] bg-surface px-4 py-2.5 text-sm text-ink transition-colors",
              "placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
              error
                ? "border-red pr-10 focus-visible:border-red focus-visible:ring-red/20"
                : "border-line focus-visible:border-orange focus-visible:ring-orange/20",
              className
            )}
            {...props}
          />
          {error && (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-red">
              <AlertCircle className="h-5 w-5" aria-hidden="true" />
            </div>
          )}
        </div>
        {error ? (
          <p className="text-xs font-medium text-red flex items-center gap-1 mt-1">
            {error}
          </p>
        ) : hint ? (
          <p className="text-xs text-muted-faro mt-1">{hint}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";
