"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";

interface CatalogSortProps {
  className?: string;
}

export function CatalogSort({ className }: CatalogSortProps) {
  const t = useTranslations("catalog");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSort = searchParams?.get("sort") || "popular";

  const handleSortChange = (newSort: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (newSort === "popular") {
      params.delete("sort");
    } else {
      params.set("sort", newSort);
    }
    params.delete("page");

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className={`relative flex items-center ${className || ""}`}>
      <label htmlFor="catalog-sort" className="sr-only">
        {t("sort")}
      </label>
      <select
        id="catalog-sort"
        value={currentSort}
        disabled={isPending}
        onChange={(e) => handleSortChange(e.target.value)}
        className="h-12 appearance-none rounded-xl border border-line bg-surface text-ink font-heading font-semibold text-xs sm:text-sm pl-4 pr-10 focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/15 shadow-subtle cursor-pointer transition-all disabled:opacity-50"
      >
        <option value="popular">{t("sortPopular")}</option>
        <option value="newest">{t("sortNewest")}</option>
        <option value="price_asc">{t("sortPriceAsc")}</option>
        <option value="price_desc">{t("sortPriceDesc")}</option>
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-muted-faro">
        <ChevronDown className="w-4 h-4 text-muted-faro" />
      </div>
    </div>
  );
}
