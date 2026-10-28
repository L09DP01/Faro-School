"use client";

import { useState, useEffect, useRef } from "react";
import { CatalogFilters } from "./CatalogFilters";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CatalogMobileDrawer() {
  const t = useTranslations("catalog");
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Calculate active filter count
  const categoriesCount = searchParams?.get("category")
    ? searchParams.get("category")!.split(",").filter(Boolean).length
    : 0;
  const levelCount = searchParams?.get("level") && searchParams.get("level") !== "all" ? 1 : 0;
  const maxPriceCount = searchParams?.get("maxPrice") ? 1 : 0;
  const activeFiltersCount = categoriesCount + levelCount + maxPriceCount;

  // Trap focus and manage body scroll
  useEffect(() => {
    if (!isOpen) return;

    // Prevent body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the first interactive element inside dialog
    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const timeoutId = setTimeout(() => {
      if (dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector);
        if (focusables.length > 0) {
          focusables[0].focus();
        }
      }
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (e.key === "Tab" && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)
        ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);

        if (focusables.length === 0) return;

        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          if (document.activeElement === lastEl) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timeoutId);
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <>
      {/* Ghost "Filtrer" button with count badge */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        className="lg:hidden inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-ink hover:text-blue hover:bg-surface/80 font-heading font-semibold text-xs border border-line bg-surface shadow-subtle transition-all active:scale-95"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Filter className="w-4 h-4 text-muted-faro" />
        <span>{t("filterButton")}</span>
        {activeFiltersCount > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue text-white text-[10px] font-bold">
            {activeFiltersCount}
          </span>
        )}
      </button>

      {/* Accessible Mobile Bottom Sheet / Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy-deep/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={handleClose}
          aria-hidden="true"
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-filters-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-h-[88vh] rounded-t-3xl border-t border-line bg-surface p-6 shadow-lift overflow-y-auto flex flex-col animate-in slide-in-from-bottom duration-200 outline-none"
          >
            {/* Header with Title and Close Button */}
            <div className="flex items-center justify-between pb-4 border-b border-line mb-4">
              <div className="flex items-center gap-2.5">
                <h2
                  id="mobile-filters-title"
                  className="font-heading text-base font-bold text-ink"
                >
                  {t("filtersTitle")}
                </h2>
                {activeFiltersCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-tint text-blue font-heading text-xs font-bold">
                    {activeFiltersCount} actif{activeFiltersCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted-faro hover:text-ink hover:bg-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40"
                aria-label="Fermer les filtres"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Controls */}
            <div className="flex-1 overflow-y-auto py-2">
              <CatalogFilters onFilterChange={() => {}} />
            </div>

            {/* Sticky Action Footer */}
            <div className="pt-4 mt-4 border-t border-line">
              <Button
                variant="primary"
                size="lg"
                type="button"
                onClick={handleClose}
                className="w-full text-sm font-semibold"
              >
                Voir les résultats
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
