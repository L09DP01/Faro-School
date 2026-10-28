import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "on-dark" | "on-light";
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}

export function Logo({
  variant = "on-light",
  className,
  width = 160,
  height = 54,
  priority = false,
}: LogoProps) {
  const src = variant === "on-dark" ? "/brand/logo-on-dark.png" : "/brand/logo-on-light.png";

  return (
    <div className={cn("relative inline-flex items-center min-w-[96px]", className)}>
      <Image
        src={src}
        alt="Faro School"
        width={width}
        height={height}
        priority={priority}
        className="h-auto w-auto max-h-12 object-contain select-none"
      />
    </div>
  );
}
