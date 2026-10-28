import React from "react";

interface UserAvatarProps {
  fullName?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  role?: string;
}

export function getInitials(fullName?: string | null): string {
  if (!fullName || typeof fullName !== "string") return "ET";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ET";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserAvatar({
  fullName,
  size = "md",
  className = "",
  role,
}: UserAvatarProps) {
  const initials = getInitials(fullName);

  const sizeClasses = {
    sm: "w-7 h-7 text-xs",
    md: "w-8 h-8 text-xs",
    lg: "w-10 h-10 text-sm",
  }[size];

  return (
    <div
      className={`rounded-full bg-navy-deep text-white font-heading font-bold flex items-center justify-center shrink-0 select-none shadow-xs border border-white/20 ${sizeClasses} ${className}`}
      title={fullName || "Utilisateur"}
      aria-label={fullName || "Avatar utilisateur"}
    >
      {initials}
    </div>
  );
}
