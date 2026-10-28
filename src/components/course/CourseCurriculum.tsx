"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { LessonPreviewModal } from "./LessonPreviewModal";
import { cn } from "@/lib/utils";
import { Play, Lock, ChevronDown } from "lucide-react";

export interface CurriculumLesson {
  id: string;
  position: number;
  title: string;
  description?: string;
  durationSec: number;
  isFreePreview: boolean;
}

export interface CurriculumModule {
  id: string;
  position: number;
  title: string;
  lessons: CurriculumLesson[];
}

interface CourseCurriculumProps {
  modules: CurriculumModule[];
  courseSlug: string;
}

export function CourseCurriculum({ modules, courseSlug }: CourseCurriculumProps) {
  const t = useTranslations("courseDetail.curriculum");

  // Keep track of expanded module IDs (closed by default on mobile, open on desktop)
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // On desktop (width >= 768px), expand the first module by default
    if (typeof window !== "undefined" && window.innerWidth >= 768 && modules.length > 0) {
      setExpandedModules({ [modules[0].id]: true });
    }
  }, [modules]);

  // Preview modal state
  const [selectedPreviewLesson, setSelectedPreviewLesson] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const toggleModule = (id: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    modules.forEach((m) => {
      all[m.id] = true;
    });
    setExpandedModules(all);
  };

  const collapseAll = () => {
    setExpandedModules({});
  };

  const formatDuration = (sec: number) => {
    const mins = Math.ceil(sec / 60);
    return `${mins} min`;
  };

  return (
    <div className="space-y-4">
      {/* Curriculum Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-2">
        <div>
          <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-ink">
            {t("title")}
          </h2>
          <p className="mt-1 font-sans text-xs sm:text-sm text-muted-faro">
            {t("subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-blue font-heading font-semibold">
          <button
            type="button"
            onClick={expandAll}
            className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40 rounded px-1"
          >
            Tout déplier
          </button>
          <span className="text-muted-faro/40">•</span>
          <button
            type="button"
            onClick={collapseAll}
            className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/40 rounded px-1"
          >
            Tout replier
          </button>
        </div>
      </div>

      {/* Modules List */}
      <div className="space-y-3">
        {modules.map((m, mIdx) => {
          const isExpanded = Boolean(expandedModules[m.id]);
          const totalDurationSec = m.lessons.reduce((acc, l) => acc + (l.durationSec || 0), 0);

          return (
            <div
              key={m.id}
              className="rounded-[18px] border border-line bg-surface overflow-hidden shadow-card transition-all"
            >
              {/* Module Header Button: module name left, duration right */}
              <button
                type="button"
                onClick={() => toggleModule(m.id)}
                className="w-full flex items-center justify-between p-4 sm:p-5 text-left bg-surface hover:bg-bg/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange/40"
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-3.5 pr-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-tint font-heading text-xs font-bold text-blue">
                    {mIdx + 1}
                  </span>
                  <div>
                    <h3 className="font-heading text-sm sm:text-base font-bold text-ink leading-snug">
                      {m.title}
                    </h3>
                    <p className="font-sans text-[11px] text-muted-faro mt-0.5">
                      {m.lessons.length} {m.lessons.length > 1 ? "leçons" : "leçon"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-sans text-xs font-medium text-muted-faro">
                    {formatDuration(totalDurationSec)}
                  </span>
                  <div className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-md text-muted-faro transition-transform duration-200",
                    isExpanded && "rotate-180"
                  )}>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </button>

              {/* Module Lessons List */}
              {isExpanded && (
                <div className="divide-y divide-line border-t border-line bg-bg/30">
                  {m.lessons.map((lesson, lIdx) => (
                    <div
                      key={lesson.id}
                      className="flex items-center justify-between p-3.5 sm:p-4 text-xs hover:bg-surface transition-colors"
                    >
                      <div className="flex items-center gap-3 pr-2">
                        {/* Status icon: Play in blue if preview, Lock otherwise */}
                        {lesson.isFreePreview ? (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedPreviewLesson({
                                id: lesson.id,
                                title: lesson.title,
                              })
                            }
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-tint text-blue hover:bg-blue hover:text-white transition-colors shadow-subtle"
                            title={t("play")}
                            aria-label={`${t("play")} : ${lesson.title}`}
                          >
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          </button>
                        ) : (
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-line/60 text-muted-faro"
                            title={t("locked")}
                          >
                            <Lock className="w-3.5 h-3.5" />
                          </span>
                        )}

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-sans font-medium text-ink">
                              {mIdx + 1}.{lIdx + 1} {lesson.title}
                            </span>
                            {lesson.isFreePreview && (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-heading font-bold bg-blue-tint text-blue uppercase tracking-wide border border-blue/20">
                                {t("freePreview")}
                              </span>
                            )}
                          </div>
                          {lesson.description && (
                            <p className="mt-0.5 font-sans text-[11px] text-muted-faro line-clamp-1">
                              {lesson.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {lesson.isFreePreview && (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedPreviewLesson({
                                id: lesson.id,
                                title: lesson.title,
                              })
                            }
                            className="font-heading text-xs font-semibold text-blue hover:underline hidden sm:inline"
                          >
                            {t("play")}
                          </button>
                        )}
                        <span className="font-sans text-xs text-muted-faro">
                          {formatDuration(lesson.durationSec)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Video Preview Modal */}
      <LessonPreviewModal
        isOpen={Boolean(selectedPreviewLesson)}
        onClose={() => setSelectedPreviewLesson(null)}
        lessonId={selectedPreviewLesson?.id || null}
        lessonTitle={selectedPreviewLesson?.title || ""}
        courseSlug={courseSlug}
      />
    </div>
  );
}
