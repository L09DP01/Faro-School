"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CatalogPaginationProps {
  currentPage: number;
  totalPages: number;
}

export function CatalogPagination({ currentPage, totalPages }: CatalogPaginationProps) {
  const t = useTranslations("catalog");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (page === 1) {
      params.delete("page");
    } else {
      params.set("page", page.toString());
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: true });
  };

  // Generate page numbers array with ellipsis
  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <nav
      className="flex items-center justify-center gap-2 pt-10 pb-4"
      aria-label="Pagination du catalogue"
    >
      {/* Previous Button (40px square) */}
      <button
        type="button"
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage <= 1}
        className="w-10 h-10 rounded-xl border border-line bg-surface text-ink hover:bg-bg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shadow-subtle transition-colors focus:outline-none focus:ring-2 focus:ring-blue/20"
        aria-label={t("prevPage")}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Number Buttons (Square 40px buttons, current page in blue) */}
      {getPageNumbers().map((p, idx) => {
        if (p === "...") {
          return (
            <span
              key={`ellipsis-${idx}`}
              className="w-10 h-10 flex items-center justify-center text-muted-faro font-heading text-sm select-none"
            >
              …
            </span>
          );
        }

        const isCurrent = p === currentPage;
        return (
          <button
            key={p}
            type="button"
            onClick={() => goToPage(p)}
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "w-10 h-10 rounded-xl font-heading font-semibold text-sm flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-blue/20",
              isCurrent
                ? "bg-blue text-white shadow-subtle"
                : "border border-line bg-surface text-ink hover:bg-bg hover:border-muted-faro/40 shadow-subtle"
            )}
          >
            {p}
          </button>
        );
      })}

      {/* Next Button (40px square) */}
      <button
        type="button"
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="w-10 h-10 rounded-xl border border-line bg-surface text-ink hover:bg-bg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shadow-subtle transition-colors focus:outline-none focus:ring-2 focus:ring-blue/20"
        aria-label={t("nextPage")}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  );
}
