"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import {
  slugify,
  validateCourseForPublish,
  type AdminCourseFormData,
  type AdminModuleForm,
} from "@/lib/admin/course-types";
import { saveCourseAction } from "@/app/actions/admin-courses";

interface CourseFormClientProps {
  initialCourse?: AdminCourseFormData | null;
  locale: string;
  userRole?: "student" | "instructor" | "admin";
  currentUserId?: string;
  availableInstructors?: Array<{ id: string; fullName: string; title?: string }>;
}

function ToggleSwitch({
  checked,
  onChange,
  id,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  id?: string;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? "bg-blue" : "bg-line"
      }`}
    >
      <span className="sr-only">{label || "Basculer"}</span>
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export function CourseFormClient({
  initialCourse,
  locale: _locale,
  userRole = "admin",
  currentUserId,
  availableInstructors = [],
}: CourseFormClientProps) {
  const router = useRouter();
  const t = useTranslations("admin.courses.form");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = Boolean(initialCourse?.id);
  const isInstructorRole = userRole === "instructor";

  // Form State
  const [selectedInstructorId, setSelectedInstructorId] = useState<string | null>(
    initialCourse?.instructorId || (isInstructorRole ? currentUserId || null : null)
  );
  const [titleFr, setTitleFr] = useState(initialCourse?.titleFr || "");
  const [titleHt, setTitleHt] = useState(initialCourse?.titleHt || "");
  const [slug, setSlug] = useState(initialCourse?.slug || "");
  const [autoSlug, setAutoSlug] = useState(!initialCourse?.slug);
  const [descriptionFr, setDescriptionFr] = useState(initialCourse?.descriptionFr || "");
  const [descriptionHt, setDescriptionHt] = useState(initialCourse?.descriptionHt || "");
  const [category, setCategory] = useState(initialCourse?.category || "marketing");
  const [level, setLevel] = useState(initialCourse?.level || "tous niveaux");
  const [language, setLanguage] = useState(
    (initialCourse?.options as any)?.language || "bilingue"
  );
  const [priceHtg, setPriceHtg] = useState<number>(initialCourse?.priceHtg ?? 3500);
  const [comparePriceHtg, setComparePriceHtg] = useState<number | null>(
    initialCourse?.comparePriceHtg ?? null
  );
  const [coverUrl, setCoverUrl] = useState(initialCourse?.coverUrl || "");

  // Options
  const [certificate, setCertificate] = useState(initialCourse?.options?.certificate ?? true);
  const [lifetimeAccess, setLifetimeAccess] = useState(
    initialCourse?.options?.lifetimeAccess ?? true
  );
  const [guaranteeDays, setGuaranteeDays] = useState(
    initialCourse?.options?.guaranteeDays ?? 7
  );
  const [moncashEnabled, setMoncashEnabled] = useState(
    initialCourse?.options?.moncashEnabled ?? true
  );
  const [natcashEnabled, setNatcashEnabled] = useState(
    initialCourse?.options?.natcashEnabled ?? true
  );

  // Modules & Lessons
  const [modules, setModules] = useState<AdminModuleForm[]>(
    initialCourse?.modules && initialCourse.modules.length > 0
      ? initialCourse.modules
      : [
          {
            titleFr: "Module 1 - Fondations",
            titleHt: "Modil 1 - Baz",
            position: 1,
            lessons: [
              {
                titleFr: "Introduction à la formation",
                titleHt: "Entwodiksyon sou fòmasyon an",
                position: 1,
                videoId: "mock_vid_intro",
                durationSec: 600,
                isFreePreview: true,
                resources: [],
              },
            ],
          },
        ]
  );

  // UI state
  const [saving, setSaving] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [videoUploadingLessonId, setVideoUploadingLessonId] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [publishPrerequisites, setPublishPrerequisites] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  // Auto-slugify as titleFr changes if autoSlug is enabled
  const handleTitleFrChange = (val: string) => {
    setTitleFr(val);
    if (fieldErrors.titleFr && val.trim().length >= 3) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.titleFr;
        return next;
      });
    }
    if (autoSlug) {
      setSlug(slugify(val));
    }
  };

  // Cover image upload handler
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setAlertError(t("coverHelp"));
      return;
    }

    setCoverUploading(true);
    setAlertError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/upload/cover", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        setCoverUrl(data.url);
        if (fieldErrors.coverUrl) {
          setFieldErrors((prev) => {
            const next = { ...prev };
            delete next.coverUrl;
            return next;
          });
        }
      } else {
        setAlertError(data.error || "Erreur de téléversement de l'image.");
      }
    } catch {
      setAlertError("Erreur de téléversement de l'image.");
    } finally {
      setCoverUploading(false);
    }
  };

  // Direct video upload handler
  const handleVideoUpload = async (mIdx: number, lIdx: number) => {
    const lessonKey = `${mIdx}-${lIdx}`;
    setVideoUploadingLessonId(lessonKey);
    setVideoProgress(15);
    setAlertError(null);

    try {
      const res = await fetch("/api/admin/video/direct-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: modules[mIdx].lessons[lIdx].titleFr || "Leçon" }),
      });

      const uploadInfo = await res.json();
      if (!res.ok) {
        throw new Error(uploadInfo.error || "Impossible d'initialiser l'upload vidéo.");
      }

      // Simulate browser TUS upload progression
      for (let p = 30; p <= 100; p += 25) {
        await new Promise((r) => setTimeout(r, 200));
        setVideoProgress(p);
      }

      setModules((prev) => {
        const copy = [...prev];
        copy[mIdx].lessons[lIdx].videoId = uploadInfo.videoId;
        copy[mIdx].lessons[lIdx].durationSec = uploadInfo.durationSec || 720;
        return copy;
      });
    } catch (err: any) {
      setAlertError(err.message || "Erreur lors de l'envoi de la vidéo.");
    } finally {
      setVideoUploadingLessonId(null);
      setVideoProgress(0);
    }
  };

  // Module actions
  const addModule = () => {
    setModules((prev) => [
      ...prev,
      {
        titleFr: `Module ${prev.length + 1}`,
        titleHt: `Modil ${prev.length + 1}`,
        position: prev.length + 1,
        lessons: [],
      },
    ]);
  };

  const deleteModule = (mIdx: number) => {
    setModules((prev) => prev.filter((_, idx) => idx !== mIdx));
  };

  const moveModule = (mIdx: number, direction: "up" | "down") => {
    if (
      (direction === "up" && mIdx === 0) ||
      (direction === "down" && mIdx === modules.length - 1)
    ) {
      return;
    }
    const targetIdx = direction === "up" ? mIdx - 1 : mIdx + 1;
    setModules((prev) => {
      const copy = [...prev];
      const temp = copy[mIdx];
      copy[mIdx] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  // Lesson actions
  const addLesson = (mIdx: number) => {
    setModules((prev) => {
      const copy = [...prev];
      const lessonCount = copy[mIdx].lessons.length;
      copy[mIdx].lessons.push({
        titleFr: `Leçon ${lessonCount + 1}`,
        titleHt: `Leson ${lessonCount + 1}`,
        position: lessonCount + 1,
        isFreePreview: false,
        resources: [],
      });
      return copy;
    });
  };

  const deleteLesson = (mIdx: number, lIdx: number) => {
    setModules((prev) => {
      const copy = [...prev];
      copy[mIdx].lessons = copy[mIdx].lessons.filter((_, idx) => idx !== lIdx);
      return copy;
    });
  };

  const moveLesson = (mIdx: number, lIdx: number, direction: "up" | "down") => {
    if (
      (direction === "up" && lIdx === 0) ||
      (direction === "down" && lIdx === modules[mIdx].lessons.length - 1)
    ) {
      return;
    }
    const targetIdx = direction === "up" ? lIdx - 1 : lIdx + 1;
    setModules((prev) => {
      const copy = [...prev];
      const lessons = [...copy[mIdx].lessons];
      const temp = lessons[lIdx];
      lessons[lIdx] = lessons[targetIdx];
      lessons[targetIdx] = temp;
      copy[mIdx].lessons = lessons;
      return copy;
    });
  };

  // Submit Handler
  const handleSubmit = async (publish: boolean) => {
    setSaving(true);
    setAlertError(null);
    setAlertSuccess(null);
    setPublishPrerequisites([]);
    const errors: { [key: string]: string } = {};

    // Validate locally for publication if publish is requested
    if (publish) {
      const check = validateCourseForPublish({
        titleFr,
        priceHtg,
        coverUrl,
        modules,
      });

      if (!check.valid) {
        setPublishPrerequisites(check.errors);
        setAlertError("Publication impossible : veuillez compléter tous les prérequis ci-dessous.");

        if (!titleFr || titleFr.trim().length < 3) {
          errors.titleFr = t("validationMissingTitle");
        }
        if (!priceHtg || priceHtg <= 0) {
          errors.priceHtg = t("validationMissingPrice");
        }
        if (!coverUrl || coverUrl.trim().length === 0) {
          errors.coverUrl = t("validationMissingCover");
        }
        const totalLessons = modules.reduce(
          (acc, m) => acc + (m.lessons ? m.lessons.length : 0),
          0
        );
        if (modules.length === 0 || totalLessons === 0) {
          errors.modules = t("validationMissingLessons");
        }
        setFieldErrors(errors);
        setSaving(false);
        // Scroll to top to see summary banner
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    } else {
      // Basic check for title
      if (!titleFr || titleFr.trim().length < 3) {
        errors.titleFr = t("validationMissingTitle");
        setFieldErrors(errors);
        setAlertError(t("validationMissingTitle"));
        setSaving(false);
        return;
      }
    }

    setFieldErrors({});

    const formData: AdminCourseFormData = {
      id: initialCourse?.id,
      slug: slug.trim(),
      titleFr: titleFr.trim(),
      titleHt: titleHt.trim(),
      descriptionFr: descriptionFr.trim(),
      descriptionHt: descriptionHt.trim(),
      category,
      level,
      priceHtg: Math.round(Number(priceHtg)),
      comparePriceHtg: comparePriceHtg ? Math.round(Number(comparePriceHtg)) : null,
      coverUrl: coverUrl.trim(),
      status: publish ? "published" : "draft",
      instructorId: isInstructorRole ? currentUserId : (selectedInstructorId || null),
      options: {
        certificate,
        lifetimeAccess,
        guaranteeDays: Number(guaranteeDays) || 7,
        moncashEnabled,
        natcashEnabled,
        ...({ language } as any),
      },
      modules: modules.map((m, mIdx) => ({
        ...m,
        position: mIdx + 1,
        lessons: m.lessons.map((l, lIdx) => ({
          ...l,
          position: lIdx + 1,
        })),
      })),
    };

    const res = await saveCourseAction(formData, publish);
    setSaving(false);

    if (res.success) {
      setAlertSuccess(publish ? t("successPublish") : t("successSave"));
      setTimeout(() => {
        router.push("/admin/formations");
      }, 1200);
    } else {
      setAlertError(res.error || "Erreur lors de l'enregistrement.");
    }
  };

  const totalLessonsCount = modules.reduce(
    (acc, m) => acc + (m.lessons ? m.lessons.length : 0),
    0
  );

  return (
    <div className="pb-20 space-y-6">
      {/* Sticky Top Bar */}
      <div className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-line -mx-4 sm:-mx-8 px-4 sm:px-8 py-3.5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm transition-all">
        <div>
          <nav aria-label="Fil d'Ariane" className="text-xs text-muted-faro flex items-center gap-1.5 mb-1">
            <Link href="/admin/formations" className="hover:text-ink transition-colors flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              <span>{t("backToList")}</span>
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-ink font-medium" aria-current="page">
              {isEditing ? t("editTitle") : t("createTitle")}
            </span>
          </nav>
          <h1 className="font-heading font-bold text-xl sm:text-[30px] leading-tight text-ink">
            {isEditing ? t("editTitle") : t("createTitle")}
          </h1>
        </div>

        {/* Action Buttons Right */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSubmit(false)}
            className="px-4 py-2.5 text-xs font-heading font-semibold rounded-xl border border-line bg-surface text-ink hover:bg-bg transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
          >
            {saving ? t("saving") : t("saveDraft")}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSubmit(true)}
            className="px-5 py-2.5 text-xs font-heading font-semibold rounded-xl bg-blue text-white hover:bg-blue/90 transition-colors disabled:opacity-50 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2"
          >
            {saving ? t("saving") : t("publish")}
          </button>
        </div>
      </div>

      {/* Summary Banner for Validation Errors / Publish Prerequisites */}
      {publishPrerequisites.length > 0 && (
        <div
          role="alert"
          className="rounded-[18px] border border-red/30 bg-red-tint p-5 text-red shadow-sm space-y-3"
        >
          <div className="flex items-center gap-2.5 font-heading font-bold text-sm">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{t("validationErrorTitle")} — Prérequis manquants</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-xs text-red/90 pl-1">
            {publishPrerequisites.map((err, idx) => (
              <li key={idx} className="font-medium">{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* General Alert Banner */}
      {alertError && publishPrerequisites.length === 0 && (
        <div
          role="alert"
          className="p-4 rounded-xl text-xs bg-red-tint border border-red/30 text-red flex items-start gap-2.5 font-medium"
        >
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{alertError}</span>
        </div>
      )}

      {alertSuccess && (
        <div
          role="status"
          className="p-4 rounded-xl text-xs bg-ok-tint border border-ok/30 text-ok flex items-start gap-2.5 font-medium"
        >
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>{alertSuccess}</span>
        </div>
      )}

      {/* Two Column Grid: 1.5fr / 1fr */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-start">
        {/* LEFT COLUMN: Informations Générales + Programme (1.5fr) */}
        <div className="space-y-6">
          {/* Card: Informations Générales */}
          <div className="bg-surface rounded-[18px] border border-line p-7 shadow-card space-y-6">
            <div className="border-b border-line pb-3">
              <h2 className="font-heading font-bold text-lg text-ink">
                {t("sectionGeneral")}
              </h2>
              <p className="text-xs text-muted-faro mt-0.5">
                Bilinguisme garanti avec double saisie en français et créole haïtien.
              </p>
            </div>

            {/* Title FR / KR Pairing */}
            <div className="space-y-4">
              {/* Title FR */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="course-title-fr" className="text-xs font-semibold text-ink flex items-center gap-1.5">
                    <span>{t("titleFrLabel")}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-tint text-blue font-bold">
                      FR
                    </span>
                  </label>
                </div>
                <input
                  id="course-title-fr"
                  type="text"
                  required
                  value={titleFr}
                  onChange={(e) => handleTitleFrChange(e.target.value)}
                  placeholder={t("titleFrPlaceholder")}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border bg-bg text-ink placeholder:text-muted-faro focus:outline-none focus:ring-2 transition-all ${
                    fieldErrors.titleFr
                      ? "border-red focus:border-red focus:ring-red/20"
                      : "border-line focus:border-blue focus:ring-blue/20"
                  }`}
                />
                {fieldErrors.titleFr && (
                  <p className="text-xs text-red font-medium flex items-center gap-1.5 mt-1">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{fieldErrors.titleFr}</span>
                  </p>
                )}
              </div>

              {/* Title KR */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="course-title-ht" className="text-xs font-semibold text-ink flex items-center gap-1.5">
                    <span>{t("titleHtLabel")}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-tint text-orange font-bold">
                      KR
                    </span>
                  </label>
                </div>
                <input
                  id="course-title-ht"
                  type="text"
                  value={titleHt}
                  onChange={(e) => setTitleHt(e.target.value)}
                  placeholder={t("titleHtPlaceholder")}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-line bg-bg text-ink placeholder:text-muted-faro focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition-all"
                />
              </div>
            </div>

            {/* Slug URL */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="course-slug" className="text-xs font-semibold text-ink">
                  {t("slugLabel")}
                </label>
                <label className="text-[11px] text-muted-faro flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSlug}
                    onChange={(e) => setAutoSlug(e.target.checked)}
                    className="rounded border-line text-blue focus:ring-blue"
                  />
                  <span>Génération automatique</span>
                </label>
              </div>
              <div className="flex items-center rounded-xl border border-line bg-bg overflow-hidden text-xs focus-within:border-orange focus-within:ring-2 focus-within:ring-orange/20">
                <span className="px-3.5 py-2.5 bg-line/40 text-muted-faro border-r border-line select-none font-mono">
                  /formations/
                </span>
                <input
                  id="course-slug"
                  type="text"
                  value={slug}
                  disabled={autoSlug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-transparent text-ink focus:outline-none disabled:opacity-70 font-mono text-xs"
                />
              </div>
              <p className="text-[11px] text-muted-faro">{t("slugHelp")}</p>
            </div>

            {/* Three Selects in a Row: Catégorie, Niveau, Langue */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* 1. Catégorie */}
              <div className="space-y-1.5">
                <label htmlFor="course-category" className="text-xs font-semibold text-ink">
                  {t("categoryLabel")}
                </label>
                <select
                  id="course-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-line bg-bg text-ink focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition-all"
                >
                  <option value="marketing">Marketing & Vente</option>
                  <option value="business">Business & Entrepreneuriat</option>
                  <option value="bureautique">Bureautique & Données</option>
                  <option value="création">Création & Vidéo</option>
                  <option value="langues">Langues & Communication</option>
                  <option value="autre">Autre thématique</option>
                </select>
              </div>

              {/* 2. Niveau */}
              <div className="space-y-1.5">
                <label htmlFor="course-level" className="text-xs font-semibold text-ink">
                  {t("levelLabel")}
                </label>
                <select
                  id="course-level"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-line bg-bg text-ink focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition-all"
                >
                  <option value="débutant">Débutant</option>
                  <option value="intermédiaire">Intermédiaire</option>
                  <option value="avancé">Avancé</option>
                  <option value="tous niveaux">Tous niveaux</option>
                </select>
              </div>

              {/* 3. Langue */}
              <div className="space-y-1.5">
                <label htmlFor="course-language" className="text-xs font-semibold text-ink">
                  Langue du cours
                </label>
                <select
                  id="course-language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-line bg-bg text-ink focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition-all"
                >
                  <option value="bilingue">Bilingue (FR & Kreyòl)</option>
                  <option value="ht">Kreyòl Ayisyen (KR)</option>
                  <option value="fr">Français (FR)</option>
                </select>
              </div>
            </div>

            {/* Descriptions FR & KR Pairing */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="course-desc-fr" className="text-xs font-semibold text-ink flex items-center gap-1.5">
                    <span>{t("descFrLabel")}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-tint text-blue font-bold">
                      FR
                    </span>
                  </label>
                </div>
                <textarea
                  id="course-desc-fr"
                  rows={3}
                  value={descriptionFr}
                  onChange={(e) => setDescriptionFr(e.target.value)}
                  placeholder="Objectifs d'apprentissage, compétences transmises..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-line bg-bg text-ink placeholder:text-muted-faro focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="course-desc-ht" className="text-xs font-semibold text-ink flex items-center gap-1.5">
                    <span>{t("descHtLabel")}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-tint text-orange font-bold">
                      KR
                    </span>
                  </label>
                </div>
                <textarea
                  id="course-desc-ht"
                  rows={3}
                  value={descriptionHt}
                  onChange={(e) => setDescriptionHt(e.target.value)}
                  placeholder="Kisa elèv la pral aprann, konesans pratik..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-line bg-bg text-ink placeholder:text-muted-faro focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Card: Programme (Curriculum Builder) */}
          <div className="bg-surface rounded-[18px] border border-line p-7 shadow-card space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-heading font-bold text-lg text-ink">
                    {t("sectionCurriculum")}
                  </h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-tint text-blue font-semibold">
                    {modules.length} {modules.length > 1 ? "modules" : "module"} • {totalLessonsCount} {totalLessonsCount > 1 ? "leçons" : "leçon"}
                  </span>
                </div>
                <p className="text-xs text-muted-faro mt-0.5">
                  Organisez les chapitres, réordonnez les modules et associez les vidéos protégées.
                </p>
              </div>
              <button
                type="button"
                onClick={addModule}
                className="px-4 py-2 text-xs font-heading font-semibold rounded-xl border border-line bg-bg text-ink hover:bg-line/40 transition-colors self-start sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
              >
                {t("addModule")}
              </button>
            </div>

            {fieldErrors.modules && (
              <p className="text-xs text-red font-medium flex items-center gap-1.5">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{fieldErrors.modules}</span>
              </p>
            )}

            {modules.length === 0 ? (
              <div className="p-8 text-center rounded-xl border-2 border-dashed border-line bg-bg/30 space-y-2">
                <p className="text-xs text-muted-faro">
                  Aucun module pour le moment. Cliquez sur &quot;+ Ajouter un module&quot; pour commencer le programme.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {modules.map((mod, mIdx) => (
                  <div
                    key={mod.id || `mod-${mIdx}`}
                    className="rounded-2xl border border-line bg-bg/40 p-5 space-y-4"
                  >
                    {/* Module Row Header */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        {/* Drag Handle & Accessible Keyboard Move Alternative */}
                        <div className="flex items-center gap-1 shrink-0 bg-surface border border-line rounded-lg p-1">
                          <button
                            type="button"
                            aria-label={`Poignée de déplacement du module ${mIdx + 1}`}
                            title="Glisser pour réorganiser"
                            className="p-1 text-muted-faro hover:text-ink cursor-grab focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue rounded"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16" />
                            </svg>
                          </button>
                          <div className="w-[1px] h-4 bg-line" aria-hidden="true" />
                          <button
                            type="button"
                            onClick={() => moveModule(mIdx, "up")}
                            disabled={mIdx === 0}
                            className="p-1 text-muted-faro hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue rounded"
                            title="Monter le module"
                            aria-label={`Monter le module ${mIdx + 1}`}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => moveModule(mIdx, "down")}
                            disabled={mIdx === modules.length - 1}
                            className="p-1 text-muted-faro hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue rounded"
                            title="Descendre le module"
                            aria-label={`Descendre le module ${mIdx + 1}`}
                          >
                            ▼
                          </button>
                        </div>

                        {/* Title FR input */}
                        <input
                          type="text"
                          value={mod.titleFr}
                          onChange={(e) => {
                            const val = e.target.value;
                            setModules((prev) => {
                              const copy = [...prev];
                              copy[mIdx].titleFr = val;
                              return copy;
                            });
                          }}
                          placeholder={t("moduleTitlePlaceholder")}
                          aria-label={`Titre en français du module ${mIdx + 1}`}
                          className="px-3 py-2 text-xs font-heading font-semibold rounded-xl border border-line bg-surface text-ink flex-1 focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20"
                        />

                        {/* Title KR input */}
                        <input
                          type="text"
                          value={mod.titleHt}
                          onChange={(e) => {
                            const val = e.target.value;
                            setModules((prev) => {
                              const copy = [...prev];
                              copy[mIdx].titleHt = val;
                              return copy;
                            });
                          }}
                          placeholder={t("moduleTitleHtPlaceholder")}
                          aria-label={`Titre en créole du module ${mIdx + 1}`}
                          className="px-3 py-2 text-xs rounded-xl border border-line bg-surface text-ink flex-1 hidden sm:block focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20"
                        />
                      </div>

                      {/* Lesson counter badge & action buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-muted-faro font-medium hidden md:inline">
                          {mod.lessons.length} {mod.lessons.length > 1 ? "leçons" : "leçon"}
                        </span>
                        <button
                          type="button"
                          onClick={() => addLesson(mIdx)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface border border-line text-ink hover:bg-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
                        >
                          {t("addLesson")}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteModule(mIdx)}
                          className="p-1.5 text-red hover:bg-red-tint rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red"
                          title={t("deleteModule")}
                          aria-label={`Supprimer le module ${mIdx + 1}`}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Lessons list inside module */}
                    <div className="space-y-3 pl-2 sm:pl-4 border-l-2 border-line">
                      {mod.lessons.length === 0 ? (
                        <p className="text-xs text-muted-faro py-2 italic">
                          Aucune leçon dans ce module. Cliquez sur &quot;+ Ajouter une leçon&quot;.
                        </p>
                      ) : (
                        mod.lessons.map((les, lIdx) => {
                          const isUploadingThisVideo = videoUploadingLessonId === `${mIdx}-${lIdx}`;

                          return (
                            <div
                              key={les.id || `les-${lIdx}`}
                              className="p-4 rounded-xl border border-line bg-surface shadow-sm space-y-3 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 flex-1">
                                  {/* Drag / reorder handles */}
                                  <div className="flex items-center gap-0.5 shrink-0 bg-bg border border-line rounded px-1 py-0.5">
                                    <span className="text-[10px] text-muted-faro font-mono px-1">
                                      #{lIdx + 1}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => moveLesson(mIdx, lIdx, "up")}
                                      disabled={lIdx === 0}
                                      className="text-[10px] text-muted-faro hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue rounded p-0.5"
                                      aria-label={`Monter la leçon ${lIdx + 1}`}
                                    >
                                      ▲
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveLesson(mIdx, lIdx, "down")}
                                      disabled={lIdx === mod.lessons.length - 1}
                                      className="text-[10px] text-muted-faro hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue rounded p-0.5"
                                      aria-label={`Descendre la leçon ${lIdx + 1}`}
                                    >
                                      ▼
                                    </button>
                                  </div>

                                  <input
                                    type="text"
                                    value={les.titleFr}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setModules((prev) => {
                                        const copy = [...prev];
                                        copy[mIdx].lessons[lIdx].titleFr = val;
                                        return copy;
                                      });
                                    }}
                                    placeholder={t("lessonTitlePlaceholder")}
                                    aria-label={`Titre de la leçon ${lIdx + 1}`}
                                    className="px-3 py-1.5 text-xs rounded-lg border border-line bg-bg text-ink flex-1 font-semibold focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20"
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={() => deleteLesson(mIdx, lIdx)}
                                  className="p-1 text-red hover:bg-red-tint rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red"
                                  title={t("deleteLesson")}
                                  aria-label={`Supprimer la leçon ${lIdx + 1}`}
                                >
                                  ✕
                                </button>
                              </div>

                              {/* Lesson Controls & Video Badge */}
                              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[11px] border-t border-line/60">
                                <label className="inline-flex items-center gap-2 text-muted-faro cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={les.isFreePreview}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setModules((prev) => {
                                        const copy = [...prev];
                                        copy[mIdx].lessons[lIdx].isFreePreview = checked;
                                        return copy;
                                      });
                                    }}
                                    className="rounded border-line text-blue focus:ring-blue"
                                  />
                                  <span className="font-medium text-ink">{t("freePreview")}</span>
                                </label>

                                {/* Video Upload status */}
                                <div className="flex items-center gap-2">
                                  {les.videoId ? (
                                    <div className="inline-flex items-center gap-1.5 text-ok font-mono text-[11px] bg-ok-tint border border-ok/30 px-2.5 py-1 rounded-lg">
                                      <span>✓ Vidéo active ({les.videoId})</span>
                                      <button
                                        type="button"
                                        onClick={() => handleVideoUpload(mIdx, lIdx)}
                                        className="text-[10px] text-muted-faro hover:text-ink underline ml-1"
                                      >
                                        Remplacer
                                      </button>
                                    </div>
                                  ) : isUploadingThisVideo ? (
                                    <div className="flex items-center gap-2 text-blue font-semibold">
                                      <span>{t("videoUploading", { progress: videoProgress })}</span>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleVideoUpload(mIdx, lIdx)}
                                      className="px-3 py-1 text-[11px] font-semibold rounded-lg bg-blue-tint text-blue hover:bg-blue/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
                                    >
                                      {t("videoUploadBtn")}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Dashed Upload Dropzone with progress bar */}
            <div className="rounded-xl border-2 border-dashed border-line hover:border-blue/50 p-6 text-center transition-colors bg-bg/30 space-y-3">
              <div className="w-10 h-10 rounded-full bg-blue-tint text-blue mx-auto flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-heading font-semibold text-ink">
                  Zone de téléversement direct de vidéos & ressources
                </p>
                <p className="text-[11px] text-muted-faro mt-0.5">
                  Fichiers MP4, MOV ou PDF (jusqu&apos;à 2 Go via Bunny Stream direct TUS)
                </p>
              </div>

              {videoUploadingLessonId && (
                <div className="max-w-xs mx-auto space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-[11px] text-muted-faro font-medium">
                    <span>Envoi vidéo en cours...</span>
                    <span>{videoProgress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-blue-tint overflow-hidden">
                    <div
                      className="h-full bg-blue transition-all duration-300"
                      style={{ width: `${videoProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Tarification + Cover + Options (1fr) */}
        <div className="space-y-6">
          {/* Card: Tarification & Moyens de paiement */}
          <div className="bg-surface rounded-[18px] border border-line p-7 shadow-card space-y-5">
            <div className="border-b border-line pb-3">
              <h2 className="font-heading font-bold text-lg text-ink">
                {t("sectionPrice")}
              </h2>
              <p className="text-xs text-muted-faro mt-0.5">
                Prix entier en Gourdes (HTG) et sélection des passerelles.
              </p>
            </div>

            {/* Price Inputs */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="course-price-htg" className="text-xs font-semibold text-ink">
                  {t("priceLabel")}
                </label>
                <div className="relative">
                  <input
                    id="course-price-htg"
                    type="number"
                    min={0}
                    step={50}
                    value={priceHtg}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPriceHtg(val);
                      if (fieldErrors.priceHtg && val > 0) {
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.priceHtg;
                          return next;
                        });
                      }
                    }}
                    className={`w-full pl-3.5 pr-14 py-2.5 text-xs rounded-xl border bg-bg text-ink focus:outline-none focus:ring-2 font-heading font-bold text-base transition-all ${
                      fieldErrors.priceHtg
                        ? "border-red focus:border-red focus:ring-red/20"
                        : "border-line focus:border-blue focus:ring-blue/20"
                    }`}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-faro select-none">
                    HTG
                  </span>
                </div>
                {fieldErrors.priceHtg && (
                  <p className="text-xs text-red font-medium flex items-center gap-1.5 mt-1">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>{fieldErrors.priceHtg}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="course-compare-price-htg" className="text-xs font-semibold text-ink">
                  {t("comparePriceLabel")}
                </label>
                <div className="relative">
                  <input
                    id="course-compare-price-htg"
                    type="number"
                    min={0}
                    step={50}
                    value={comparePriceHtg ?? ""}
                    onChange={(e) =>
                      setComparePriceHtg(e.target.value ? Number(e.target.value) : null)
                    }
                    placeholder="Ex: 5000"
                    className="w-full pl-3.5 pr-14 py-2.5 text-xs rounded-xl border border-line bg-bg text-ink focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition-all"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-faro select-none">
                    HTG
                  </span>
                </div>
              </div>
            </div>

            {/* Real Toggle Switches for MonCash & NatCash */}
            <div className="pt-2 space-y-3">
              <p className="text-xs font-heading font-semibold text-ink">
                {t("paymentToggles")}
              </p>

              {/* MonCash Toggle Tile */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-line bg-bg/50">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red shrink-0" aria-hidden="true" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs text-ink">{t("moncashLabel")}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-tint text-red font-bold">
                        Digicel
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-faro">Passerelle automatisée Kobara</p>
                  </div>
                </div>
                <ToggleSwitch
                  id="toggle-moncash"
                  label={t("moncashLabel")}
                  checked={moncashEnabled}
                  onChange={setMoncashEnabled}
                />
              </div>

              {/* NatCash Toggle Tile */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-line bg-bg/50">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange shrink-0" aria-hidden="true" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs text-ink">{t("natcashLabel")}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-orange-tint text-orange font-bold">
                        Natcom
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-faro">Virement marchand vérifié</p>
                  </div>
                </div>
                <ToggleSwitch
                  id="toggle-natcash"
                  label={t("natcashLabel")}
                  checked={natcashEnabled}
                  onChange={setNatcashEnabled}
                />
              </div>
            </div>
          </div>

          {/* Card: Image de Couverture (Cover) */}
          <div className="bg-surface rounded-[18px] border border-line p-7 shadow-card space-y-5">
            <div className="border-b border-line pb-3">
              <h2 className="font-heading font-bold text-lg text-ink">
                {t("sectionCover")}
              </h2>
              <p className="text-xs text-muted-faro mt-0.5">
                {t("coverHelp")}
              </p>
            </div>

            {/* 16:9 Preview Thumbnail Box */}
            <div className="w-full aspect-video rounded-xl border border-line bg-bg overflow-hidden relative shadow-inner">
              {coverUrl ? (
                <Image
                  src={coverUrl}
                  alt="Aperçu couverture"
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-faro p-4 text-center">
                  <svg className="w-8 h-8 mb-1.5 text-muted-faro/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs font-semibold">Format 16:9</span>
                  <span className="text-[10px] text-muted-faro mt-0.5">1280 x 720 px recommandé</span>
                </div>
              )}
            </div>

            {fieldErrors.coverUrl && (
              <p className="text-xs text-red font-medium flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{fieldErrors.coverUrl}</span>
              </p>
            )}

            {/* Upload Buttons */}
            <div className="space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/webp"
                onChange={handleCoverUpload}
                className="hidden"
                aria-label="Sélectionner une image"
              />
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={coverUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 text-xs font-heading font-semibold rounded-xl border border-line bg-surface text-ink hover:bg-bg transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
                >
                  {coverUploading ? t("coverUploading") : coverUrl ? "Modifier l'image" : t("coverUploadBtn")}
                </button>
                {coverUrl && (
                  <button
                    type="button"
                    onClick={() => setCoverUrl("")}
                    className="px-3 py-2 text-xs font-semibold rounded-xl text-red hover:bg-red-tint transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red"
                  >
                    {t("coverRemove")}
                  </button>
                )}
              </div>

              {/* Direct CDN URL input fallback */}
              <div className="space-y-1">
                <label htmlFor="cover-cdn-url" className="text-[11px] text-muted-faro font-medium">
                  Ou collez directement une URL d&apos;image CDN :
                </label>
                <input
                  id="cover-cdn-url"
                  type="text"
                  value={coverUrl}
                  onChange={(e) => {
                    setCoverUrl(e.target.value);
                    if (fieldErrors.coverUrl && e.target.value.trim().length > 0) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.coverUrl;
                        return next;
                      });
                    }
                  }}
                  placeholder="https://cdn.faroschool.com/covers/..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-line bg-bg text-ink focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Card: Options de la formation */}
          <div className="bg-surface rounded-[18px] border border-line p-7 shadow-card space-y-5">
            <div className="border-b border-line pb-3">
              <h2 className="font-heading font-bold text-lg text-ink">
                {t("sectionOptions")}
              </h2>
              <p className="text-xs text-muted-faro mt-0.5">
                Paramétrez la délivrance du diplôme et les garanties.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              {/* Option 1: Certificat officiel */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-line bg-bg/50">
                <div className="space-y-0.5 pr-3">
                  <span className="font-semibold text-ink block">{t("optionCert")}</span>
                  <span className="text-[11px] text-muted-faro block">Génération automatique de certificat PDF avec QR code</span>
                </div>
                <ToggleSwitch
                  id="toggle-cert"
                  label={t("optionCert")}
                  checked={certificate}
                  onChange={setCertificate}
                />
              </div>

              {/* Option 2: Accès illimité à vie */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-line bg-bg/50">
                <div className="space-y-0.5 pr-3">
                  <span className="font-semibold text-ink block">{t("optionAccess")}</span>
                  <span className="text-[11px] text-muted-faro block">L&apos;élève conserve l&apos;accès après l&apos;achat sans abonnement</span>
                </div>
                <ToggleSwitch
                  id="toggle-lifetime"
                  label={t("optionAccess")}
                  checked={lifetimeAccess}
                  onChange={setLifetimeAccess}
                />
              </div>

              {/* Option 3: Garantie satisfait ou remboursé */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-line bg-bg/50">
                <div className="space-y-0.5 pr-3">
                  <label htmlFor="course-guarantee-days" className="font-semibold text-ink block">
                    {t("optionGuarantee")}
                  </label>
                  <span className="text-[11px] text-muted-faro block">Délai pour demander un remboursement intégral</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    id="course-guarantee-days"
                    type="number"
                    min={0}
                    max={30}
                    value={guaranteeDays}
                    onChange={(e) => setGuaranteeDays(Number(e.target.value))}
                    className="w-16 px-2.5 py-1.5 text-xs rounded-lg border border-line bg-surface text-ink font-bold text-center focus:outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
                  />
                  <span className="text-muted-faro text-xs font-medium">jours</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Formateur Responsable (Instructor Assignment) */}
          <div className="bg-surface rounded-[18px] border border-line p-7 shadow-card space-y-4">
            <div className="border-b border-line pb-3">
              <h2 className="font-heading font-bold text-lg text-ink">
                Formateur & Responsabilité
              </h2>
              <p className="text-xs text-muted-faro mt-0.5">
                {isInstructorRole
                  ? "Attribution directe et verrouillée à votre compte formateur."
                  : "Assignez ou réassignez l'instructeur responsable de cette formation."}
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="course-assigned-instructor" className="text-xs font-semibold text-ink">
                Instructeur assigné
              </label>

              {isInstructorRole ? (
                <div className="p-3.5 rounded-xl border border-line bg-bg/50 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 text-white font-heading font-bold text-xs flex items-center justify-center shrink-0 shadow-subtle">
                      FR
                    </div>
                    <div>
                      <p className="text-xs font-heading font-bold text-ink">Mon compte formateur</p>
                      <p className="text-[11px] text-muted-faro font-mono truncate">
                        Attribution réservée au créateur
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-line text-muted-faro">
                    Verrouillé
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    id="course-assigned-instructor"
                    value={selectedInstructorId || ""}
                    onChange={(e) => setSelectedInstructorId(e.target.value || null)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-line bg-bg text-ink focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue/20 transition-all"
                  >
                    <option value="">Formateur par défaut (Admin Faro)</option>
                    {availableInstructors.length > 0 ? (
                      availableInstructors.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.fullName} {inst.title ? `— ${inst.title}` : ""}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="mock-admin-id">Professeur Faro (Directeur)</option>
                        <option value="mock-instructor-id">Jean-Baptiste Formateur (Marketing)</option>
                        <option value="inst-003">Nadine Pierre-Louis (Anglais des Affaires)</option>
                      </>
                    )}
                  </select>
                  <p className="text-[11px] text-muted-faro">
                    L&apos;instructeur assigné aura les droits d&apos;édition sur ce cours et pourra consulter les élèves inscrits.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="flex items-center justify-between pt-6 border-t border-line mt-8">
        <Link
          href="/admin/formations"
          className="px-4 py-2 text-xs font-semibold rounded-xl border border-line text-ink hover:bg-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
        >
          {t("backToList")}
        </Link>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSubmit(false)}
            className="px-5 py-2.5 text-xs font-heading font-semibold rounded-xl border border-line bg-surface text-ink hover:bg-bg transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue"
          >
            {saving ? t("saving") : t("saveDraft")}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSubmit(true)}
            className="px-6 py-2.5 text-xs font-heading font-semibold rounded-xl bg-blue text-white hover:bg-blue/90 transition-colors disabled:opacity-50 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2"
          >
            {saving ? t("saving") : t("publish")}
          </button>
        </div>
      </div>
    </div>
  );
}
