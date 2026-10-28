import { cn } from "@/lib/utils";

interface PriceTagProps {
  priceHtg: number;
  comparePriceHtg?: number | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * PriceTag displays integer Haitian Gourde amounts.
 * Example: 2500 -> "2 500 HTG"
 */
export function PriceTag({
  priceHtg,
  comparePriceHtg,
  className,
  size = "md",
}: PriceTagProps) {
  // Format with French space grouping (e.g. 2 500)
  const formatAmount = (num: number) =>
    new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: 0,
    }).format(num);

  const sizeClasses = {
    sm: "text-sm",
    md: "text-base font-semibold",
    lg: "text-xl font-bold",
  };

  return (
    <div className={cn("inline-flex items-baseline gap-2", className)}>
      <span className={cn("text-foreground", sizeClasses[size])}>
        {formatAmount(priceHtg)} HTG
      </span>
      {comparePriceHtg && comparePriceHtg > priceHtg && (
        <span className="text-xs sm:text-sm text-muted-foreground line-through">
          {formatAmount(comparePriceHtg)} HTG
        </span>
      )}
    </div>
  );
}
