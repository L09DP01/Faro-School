"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import type { AdminCourseListItem } from "@/lib/admin/course-types";
import {
  toggleCoursePublishAction,
  duplicateCourseAction,
  deleteCourseAction,
} from "@/app/actions/admin-courses";

interface CourseListClientProps {
  courses: AdminCourseListItem[];
  locale: string;
}

export function CourseListClient({ courses, locale }: CourseListClientProps) {
  const router = useRouter();
  const t = useTranslations("admin.courses");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [courseList, setCourseList] = useState(courses);
  const [busyCourseId, setBusyCourseId] = useState<string | null>(null);
  const [deleteModalCourse, setDeleteModalCourse] = useState<AdminCourseListItem | null>(null);
  const [alertMessage, setAlertMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const formatHtg = (amount: number) => {
    return (
      new Intl.NumberFormat(locale === "ht" ? "fr-HT" : "fr-FR", {
        maximumFractionDigits: 0,
      }).format(amount) + " HTG"
    );
  };

  // Filter courses by search query and status
  const filteredCourses = courseList.filter((c) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      c.titleFr.toLowerCase().includes(q) ||
      c.titleHt.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === "all" || c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleTogglePublish = async (course: AdminCourseListItem) => {
    const targetStatus = course.status === "published" ? "draft" : "published";
    setBusyCourseId(course.id);
    setAlertMessage(null);

    const res = await toggleCoursePublishAction(course.id, targetStatus);
    setBusyCourseId(null);

    if (res.success) {
      setCourseList((prev) =>
        prev.map((c) => (c.id === course.id ? { ...c, status: targetStatus } : c))
      );
      setAlertMessage({
        type: "success",
        text: targetStatus === "published" ? t("form.successPublish") : t("form.successUnpublish"),
      });
    } else {
      setAlertMessage({
        type: "error",
        text: res.error || "Action impossible.",
      });
    }
  };

  const handleDuplicate = async (course: AdminCourseListItem) => {
    setBusyCourseId(course.id);
    setAlertMessage(null);

    const res = await duplicateCourseAction(course.id);
    setBusyCourseId(null);

    if (res.success) {
      setAlertMessage({
        type: "success",
        text: t("form.successDuplicate"),
      });
      router.refresh();
    } else {
      setAlertMessage({
        type: "error",
        text: res.error || "Erreur lors de la duplication.",
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModalCourse) return;
    setBusyCourseId(deleteModalCourse.id);
    setAlertMessage(null);

    const res = await deleteCourseAction(deleteModalCourse.id);
    setBusyCourseId(null);
    const deletedId = deleteModalCourse.id;
    setDeleteModalCourse(null);

    if (res.success) {
      setCourseList((prev) => prev.filter((c) => c.id !== deletedId));
      setAlertMessage({
        type: "success",
        text: t("form.successDelete"),
      });
    } else {
      setAlertMessage({
        type: "error",
        text: res.error || "Erreur de suppression.",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header with Title and Create CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <nav aria-label="Fil d'Ariane" className="text-xs text-muted-faro flex items-center gap-1.5 mb-1.5">
            <Link href="/admin" className="hover:text-ink transition-colors">
              Administration
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-ink font-medium" aria-current="page">Formations</span>
          </nav>
          <h1 className="font-heading font-bold text-2xl sm:text-[30px] leading-tight text-ink">
            {t("listTitle")}
          </h1>
          <p className="text-sm text-muted-faro mt-1 font-sans">{t("listSubtitle")}</p>
        </div>
        <Link
          href="/admin/formations/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue text-white font-heading font-semibold text-sm hover:bg-blue/90 transition-colors shadow-sm self-start sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          <span>{t("newCourse")}</span>
        </Link>
      </div>

      {/* Alert banner if message */}
      {alertMessage && (
        <div
          role="status"
          className={`p-4 rounded-xl text-xs flex items-start justify-between gap-3 border ${
            alertMessage.type === "success"
              ? "bg-ok-tint text-ok border-ok/30"
              : "bg-red-tint text-red border-red/30"
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {alertMessage.type === "success" ? (
              <svg className="w-5 h-5 text-ok shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            <span>{alertMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setAlertMessage(null)}
            className="text-xs font-bold hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue rounded p-0.5"
            aria-label="Fermer l'alerte"
          >
            ✕
          </button>
        </div>
      )}

      {/* Search and Filters Card */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-4 rounded-[18px] border border-line shadow-card">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <svg
            className="w-4 h-4 text-muted-faro absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-line bg-bg text-ink placeholder:text-muted-faro focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition-all"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="inline-flex items-center p-1 bg-bg rounded-xl border border-line text-xs font-medium self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue ${
              statusFilter === "all"
                ? "bg-surface text-ink font-semibold shadow-sm"
                : "text-muted-faro hover:text-ink"
            }`}
          >
            {t("filterAll")} ({courseList.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("published")}
            className={`px-3 py-1.5 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue ${
              statusFilter === "published"
                ? "bg-surface text-ink font-semibold shadow-sm"
                : "text-muted-faro hover:text-ink"
            }`}
          >
            {t("filterPublished")} ({courseList.filter((c) => c.status === "published").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("draft")}
            className={`px-3 py-1.5 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue ${
              statusFilter === "draft"
                ? "bg-surface text-ink font-semibold shadow-sm"
                : "text-muted-faro hover:text-ink"
            }`}
          >
            {t("filterDraft")} ({courseList.filter((c) => c.status === "draft").length})
          </button>
        </div>
      </div>

      {/* Courses Table Card */}
      <div className="rounded-[18px] border border-line bg-surface shadow-card overflow-hidden">
        {filteredCourses.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-blue-tint text-blue mx-auto flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className="text-sm font-medium text-ink">{t("empty")}</p>
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-xs font-semibold text-blue hover:underline"
              >
                Réinitialiser la recherche
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line bg-bg/50 text-muted-faro font-heading font-semibold">
                  <th scope="col" className="py-3.5 px-4 w-20">{t("colCover")}</th>
                  <th scope="col" className="py-3.5 px-4">{t("colTitle")}</th>
                  <th scope="col" className="py-3.5 px-4 text-center">{t("colStatus")}</th>
                  <th scope="col" className="py-3.5 px-4 text-right">{t("colPrice")}</th>
                  <th scope="col" className="py-3.5 px-4 text-center">{t("colStudents")}</th>
                  <th scope="col" className="py-3.5 px-4 text-right">{t("colRevenue")}</th>
                  <th scope="col" className="py-3.5 px-4 text-right">{t("colActions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {filteredCourses.map((course) => {
                  const title = locale === "ht" && course.titleHt ? course.titleHt : course.titleFr;
                  const isBusy = busyCourseId === course.id;

                  return (
                    <tr key={course.id} className="hover:bg-bg/40 transition-colors">
                      {/* Cover Thumbnail (16:9) */}
                      <td className="py-3.5 px-4">
                        <div className="w-16 h-10 rounded-lg bg-bg overflow-hidden relative shrink-0 border border-line aspect-video">
                          {course.coverUrl ? (
                            <Image
                              src={course.coverUrl}
                              alt={title}
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-faro font-mono">
                              16:9
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Title & Metadata */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <Link
                          href={`/admin/formations/${course.id}/edit`}
                          className="font-heading font-semibold text-ink hover:text-blue transition-colors line-clamp-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue rounded"
                        >
                          {title}
                        </Link>
                        <div className="text-[11px] text-muted-faro font-mono flex items-center gap-1.5 mt-0.5">
                          <span>/{course.slug}</span>
                          <span>•</span>
                          <span className="capitalize">{course.category}</span>
                          <span>•</span>
                          <span>{course.lessonsCount} leçons</span>
                        </div>
                      </td>

                      {/* Status Tag */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {course.status === "published" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-ok-tint text-ok border border-ok/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-ok" />
                            {t("statusPublished")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-bg text-muted-faro border border-line">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-faro" />
                            {t("statusDraft")}
                          </span>
                        )}
                      </td>

                      {/* Price */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold text-ink text-sm">
                        {formatHtg(course.priceHtg)}
                        {course.comparePriceHtg && (
                          <div className="text-[10px] text-muted-faro line-through font-normal">
                            {formatHtg(course.comparePriceHtg)}
                          </div>
                        )}
                      </td>

                      {/* Students */}
                      <td className="py-3.5 px-4 text-center font-medium text-ink whitespace-nowrap">
                        {course.studentsCount}
                      </td>

                      {/* Revenue */}
                      <td className="py-3.5 px-4 text-right font-bold text-ink whitespace-nowrap">
                        {formatHtg(course.revenueHtg)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {/* Edit button */}
                          <Link
                            href={`/admin/formations/${course.id}/edit`}
                            className="p-1.5 rounded-lg text-muted-faro hover:text-ink hover:bg-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
                            title={t("actionEdit")}
                            aria-label={`Modifier ${title}`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Link>

                          {/* Publish/Unpublish toggle */}
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleTogglePublish(course)}
                            className={`p-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue ${
                              course.status === "published"
                                ? "text-orange hover:bg-orange-tint"
                                : "text-ok hover:bg-ok-tint"
                            }`}
                            title={course.status === "published" ? t("actionUnpublish") : t("actionPublish")}
                            aria-label={course.status === "published" ? `Dépublier ${title}` : `Publier ${title}`}
                          >
                            {course.status === "published" ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>

                          {/* Duplicate button */}
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDuplicate(course)}
                            className="p-1.5 rounded-lg text-muted-faro hover:text-ink hover:bg-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
                            title={t("actionDuplicate")}
                            aria-label={`Dupliquer ${title}`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>

                          {/* Delete button */}
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setDeleteModalCourse(course)}
                            className="p-1.5 rounded-lg text-red hover:bg-red-tint transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red"
                            title={t("actionDelete")}
                            aria-label={`Supprimer ${title}`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="bg-surface border border-line rounded-[18px] shadow-2xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center gap-3 text-red">
              <div className="w-10 h-10 rounded-full bg-red-tint border border-red/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 id="delete-dialog-title" className="font-heading font-bold text-base text-ink">
                {t("deleteConfirmTitle")}
              </h2>
            </div>

            <p className="text-xs text-muted-faro leading-relaxed font-sans">
              {t("deleteConfirmMessage")}
            </p>

            <div className="p-3 bg-bg rounded-xl border border-line text-xs font-semibold text-ink">
              {deleteModalCourse.titleFr}
              {deleteModalCourse.studentsCount > 0 && (
                <div className="text-orange font-normal mt-1 flex items-center gap-1.5">
                  <span aria-hidden="true">⚠️</span>
                  <span>Attention : {deleteModalCourse.studentsCount} élève(s) inscrit(s).</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalCourse(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-line text-ink hover:bg-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
              >
                {t("deleteCancelBtn")}
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-red text-white hover:bg-red/90 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red"
              >
                {t("deleteConfirmBtn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
