import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "link" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "default",
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-heading font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer";

    const variantStyles = {
      // Primary: Orange, bold, hover lift, white text (accessible contrast on orange-strong)
      primary:
        "bg-orange text-white hover:bg-orange-strong shadow-orange hover:-translate-y-0.5 active:translate-y-0 focus-visible:ring-orange",
      // Secondary: Outline with navy border or navy background
      secondary:
        "bg-navy text-white hover:bg-navy-deep focus-visible:ring-navy shadow-sm",
      // Outline: Navy border, navy text
      outline:
        "border-2 border-navy text-navy bg-transparent hover:bg-navy/5 focus-visible:ring-navy",
      // Ghost: Navy text, subtle hover
      ghost:
        "text-navy hover:bg-navy/5 focus-visible:ring-navy",
      // Link: Blue link with underline on hover
      link:
        "text-blue underline-offset-4 hover:underline p-0 h-auto font-sans focus-visible:ring-blue",
      // Destructive
      destructive:
        "bg-red text-white hover:bg-red/90 focus-visible:ring-red shadow-sm",
    };

    const sizeStyles = {
      // Min touch target 44px on mobile for default and lg
      default: "min-h-[44px] px-5 py-2.5 text-sm rounded-xl",
      sm: "min-h-[36px] px-3.5 py-1.5 text-xs rounded-lg",
      lg: "min-h-[48px] px-7 py-3 text-base rounded-xl font-bold",
      icon: "h-11 w-11 min-h-[44px] min-w-[44px] p-0 rounded-xl",
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
