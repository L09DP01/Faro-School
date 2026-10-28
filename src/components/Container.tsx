import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface ContainerProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "main" | "section" | "article" | "header" | "footer";
}

export function Container({
  children,
  className,
  as: Component = "div",
}: ContainerProps) {
  return (
    <Component
      className={cn(
        "w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8",
        className
      )}
    >
      {children}
    </Component>
  );
}
