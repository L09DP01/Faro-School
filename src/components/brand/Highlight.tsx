import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface HighlightProps {
  children: ReactNode;
  className?: string;
}

export function Highlight({ children, className }: HighlightProps) {
  return (
    <span
      className={cn(
        "font-heading font-semibold italic text-orange tracking-tight inline-block",
        className
      )}
    >
      {children}
    </span>
  );
}
