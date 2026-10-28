"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const AVAILABLE_CATEGORIES = [
  { id: "marketing", label: "Marketing & Vente" },
  { id: "business", label: "Business & Entrepreneuriat" },
  { id: "bureautique", label: "Bureautique & Excel" },
  { id: "finance", label: "Finance & Comptabilité" },
  { id: "création", label: "Création Vidéo" },
  { id: "langues", label: "Langues" },
];

const AVAILABLE_LEVELS = [
  { id: "all", labelKey: "allLevels" },
  { id: "débutant", label: "Débutant" },
  { id: "intermédiaire", label: "Intermédiaire" },
  { id: "avancé", label: "Avancé" },
];

interface CatalogFiltersProps {
  onFilterChange?: () => void;
  className?: string;
}

export function CatalogFilters({ onFilterChange, className }: CatalogFiltersProps) {
  const t = useTranslations("catalog");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Current values from URL searchParams
  const selectedCategories = searchParams?.get("category")
    ? searchParams.get("category")!.split(",").filter(Boolean)
    : [];
  const selectedLevel = searchParams?.get("level") || "all";
  const selectedMaxPrice = searchParams?.get("maxPrice")
    ? Number(searchParams.get("maxPrice"))
    : 10000;

  const [localMaxPrice, setLocalMaxPrice] = useState(selectedMaxPrice);

  useEffect(() => {
    setLocalMaxPrice(selectedMaxPrice);
  }, [selectedMaxPrice]);

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams?.toString() || "");

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "" || (key === "level" && value === "all")) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    params.delete("page"); // reset to page 1 on filter change

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      if (onFilterChange) onFilterChange();
    });
  };

  // Toggle Category
  const toggleCategory = (categoryId: string) => {
    let next: string[];
    if (selectedCategories.includes(categoryId)) {
      next = selectedCategories.filter((c) => c !== categoryId);
    } else {
      next = [...selectedCategories, categoryId];
    }
    updateParams({ category: next.length > 0 ? next.join(",") : null });
  };

  // Select Level
  const selectLevel = (levelId: string) => {
    updateParams({ level: levelId });
  };

  // Commit Max Price
  const commitMaxPrice = (price: number) => {
    updateParams({ maxPrice: price < 10000 ? price.toString() : null });
  };

  // Clear all filters
  const clearAllFilters = () => {
    startTransition(() => {
      router.replace(pathname, { scroll: false });
      if (onFilterChange) onFilterChange();
    });
  };

  const hasActiveFilters =
    Boolean(searchParams?.get("category")) ||
    (Boolean(searchParams?.get("level")) && searchParams?.get("level") !== "all") ||
    Boolean(searchParams?.get("maxPrice")) ||
    Boolean(searchParams?.get("q"));

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header & Clear filters */}
      <div className="flex items-center justify-between pb-3.5 border-b border-line">
        <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-ink">
          {t("filtersTitle")}
        </h3>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAllFilters}
            disabled={isPending}
            className="inline-flex items-center gap-1 font-heading text-xs font-semibold text-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40 rounded px-1 disabled:opacity-50"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{t("clearFilters")}</span>
          </button>
        )}
      </div>

      {/* 1. Categories (Checkbox list with blue checked boxes) */}
      <div className="space-y-3">
        <p className="font-heading text-xs font-bold text-ink uppercase tracking-wide">
          {t("categories")}
        </p>
        <div className="space-y-2.5">
          {AVAILABLE_CATEGORIES.map((cat) => {
            const checked = selectedCategories.includes(cat.id);
            return (
              <label
                key={cat.id}
                className="group flex items-center gap-2.5 text-xs sm:text-sm text-ink cursor-pointer select-none transition-colors"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCategory(cat.id)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                    checked
                      ? "border-blue bg-blue text-white"
                      : "border-line bg-surface group-hover:border-blue/60"
                  )}
                  aria-hidden="true"
                >
                  {checked && <Check className="w-3 h-3 stroke-[3]" />}
                </span>
                <span className={cn(
                  "font-sans transition-colors",
                  checked ? "font-semibold text-ink" : "text-muted-faro group-hover:text-ink"
                )}>
                  {cat.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 2. Price Slider with blue track */}
      <div className="space-y-3 pt-4 border-t border-line">
        <div className="flex items-center justify-between">
          <p className="font-heading text-xs font-bold text-ink uppercase tracking-wide">
            {t("maxPrice")}
          </p>
          <span className="font-heading text-xs font-bold text-blue bg-blue-tint px-2 py-0.5 rounded-md">
            {localMaxPrice.toLocaleString()} HTG
          </span>
        </div>

        <input
          type="range"
          min={1000}
          max={10000}
          step={500}
          value={localMaxPrice}
          onChange={(e) => setLocalMaxPrice(Number(e.target.value))}
          onMouseUp={() => commitMaxPrice(localMaxPrice)}
          onTouchEnd={() => commitMaxPrice(localMaxPrice)}
          className="w-full h-2 rounded-lg bg-blue-tint accent-blue cursor-pointer"
          aria-label={t("maxPrice")}
        />

        <div className="flex justify-between text-[11px] font-sans font-medium text-muted-faro">
          <span>1 000 HTG</span>
          <span>10 000 HTG</span>
        </div>
      </div>

      {/* 3. Level (Radio levels with blue indicators) */}
      <div className="space-y-3 pt-4 border-t border-line">
        <p className="font-heading text-xs font-bold text-ink uppercase tracking-wide">
          {t("levels")}
        </p>
        <div className="space-y-2.5">
          {AVAILABLE_LEVELS.map((lvl) => {
            const checked = selectedLevel === lvl.id;
            const label = lvl.labelKey ? t(lvl.labelKey as any) : lvl.label;
            return (
              <label
                key={lvl.id}
                className="group flex items-center gap-2.5 text-xs sm:text-sm text-ink cursor-pointer select-none transition-colors"
              >
                <input
                  type="radio"
                  name="level"
                  checked={checked}
                  onChange={() => selectLevel(lvl.id)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                    checked
                      ? "border-blue bg-surface"
                      : "border-line bg-surface group-hover:border-blue/60"
                  )}
                  aria-hidden="true"
                >
                  {checked && <span className="h-2 w-2 rounded-full bg-blue" />}
                </span>
                <span className={cn(
                  "font-sans transition-colors",
                  checked ? "font-semibold text-ink" : "text-muted-faro group-hover:text-ink"
                )}>
                  {label}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
