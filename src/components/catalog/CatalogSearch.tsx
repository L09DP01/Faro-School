"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useState, useTransition, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Search, X, Loader2 } from "lucide-react";

interface CatalogSearchProps {
  initialQuery?: string;
  className?: string;
}

export function CatalogSearch({ initialQuery = "", className }: CatalogSearchProps) {
  const t = useTranslations("catalog");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  // Keep local state in sync if URL changes externally
  useEffect(() => {
    setSearchTerm(initialQuery);
  }, [initialQuery]);

  const updateSearch = (query: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (query.trim()) {
      params.set("q", query.trim());
    } else {
      params.delete("q");
    }
    params.delete("page"); // reset to page 1 on new search

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  // Debounced input handler
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== initialQuery) {
        updateSearch(searchTerm);
      }
    }, 350);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const handleClear = () => {
    setSearchTerm("");
    updateSearch("");
  };

  return (
    <div className={`relative w-full ${className || ""}`}>
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-faro">
        <Search className="w-5 h-5 text-muted-faro" />
      </div>

      <input
        type="search"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder={t("searchPlaceholder")}
        className="w-full h-12 pl-11 pr-11 text-sm sm:text-base font-sans rounded-xl border border-line bg-surface text-ink placeholder:text-muted-faro/70 focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/15 shadow-subtle transition-all"
        aria-label={t("searchPlaceholder")}
      />

      {searchTerm && !isPending && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-faro hover:text-ink transition-colors"
          aria-label="Effacer la recherche"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {isPending && (
        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-blue">
          <Loader2 className="w-4 h-4 animate-spin text-blue" />
        </div>
      )}
    </div>
  );
}
