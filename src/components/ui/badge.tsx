import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "orange" | "blue" | "navy" | "success" | "danger";
}

export function Badge({
  className,
  variant = "neutral",
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    neutral: "bg-surface border border-line text-ink",
    orange: "bg-orange-tint text-orange-strong border border-orange/20 font-bold",
    blue: "bg-blue-tint text-blue border border-blue/20 font-bold",
    navy: "bg-navy text-white font-bold",
    success: "bg-ok-tint text-ok border border-ok/20 font-bold",
    danger: "bg-red-tint text-red border border-red/20 font-bold",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold tracking-wide select-none shadow-subtle",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export const Pill = Badge;
export const Tag = Badge;
