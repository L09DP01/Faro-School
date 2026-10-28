import { z } from "zod";

export interface AdminCourseListItem {
  id: string;
  slug: string;
  titleFr: string;
  titleHt: string;
  descriptionFr: string;
  descriptionHt: string;
  priceHtg: number;
  comparePriceHtg: number | null;
  level: string;
  category: string;
  coverUrl: string | null;
  status: "draft" | "published";
  createdAt: string;
  studentsCount: number;
  revenueHtg: number;
  modulesCount: number;
  lessonsCount: number;
  instructorId?: string | null;
}

export interface AdminResourceForm {
  id?: string;
  name: string;
  fileUrl: string;
}

export interface AdminLessonForm {
  id?: string;
  titleFr: string;
  titleHt: string;
  descriptionFr?: string;
  descriptionHt?: string;
  position: number;
  videoId?: string;
  durationSec?: number;
  isFreePreview: boolean;
  resources: AdminResourceForm[];
}

export interface AdminModuleForm {
  id?: string;
  titleFr: string;
  titleHt: string;
  position: number;
  lessons: AdminLessonForm[];
}

export interface AdminCourseOptions {
  certificate: boolean;
  lifetimeAccess: boolean;
  guaranteeDays: number;
  moncashEnabled?: boolean;
  natcashEnabled?: boolean;
}

export interface AdminCourseFormData {
  id?: string;
  slug: string;
  titleFr: string;
  titleHt: string;
  descriptionFr: string;
  descriptionHt: string;
  priceHtg: number;
  comparePriceHtg?: number | null;
  level: string;
  category: string;
  coverUrl: string;
  status: "draft" | "published";
  options: AdminCourseOptions;
  modules: AdminModuleForm[];
  instructorId?: string | null;
}

export const adminCourseZodSchema = z.object({
  id: z.string().optional(),
  instructorId: z.string().nullable().optional(),
  slug: z
    .string()
    .min(2, "L'identifiant URL doit faire au moins 2 caractères.")
    .regex(/^[a-z0-9-]+$/, "Le slug doit contenir uniquement des lettres minuscules, chiffres et tirets."),
  titleFr: z.string().min(3, "Le titre français doit comporter au moins 3 caractères."),
  titleHt: z.string().optional().default(""),
  descriptionFr: z.string().optional().default(""),
  descriptionHt: z.string().optional().default(""),
  priceHtg: z.coerce.number().int().min(0, "Le prix en HTG doit être supérieur ou égal à 0."),
  comparePriceHtg: z.coerce.number().int().nullable().optional(),
  level: z.string().default("tous niveaux"),
  category: z.string().default("general"),
  coverUrl: z.string().optional().default(""),
  status: z.enum(["draft", "published"]).default("draft"),
  options: z.object({
    certificate: z.boolean().default(true),
    lifetimeAccess: z.boolean().default(true),
    guaranteeDays: z.number().int().default(7),
    moncashEnabled: z.boolean().default(true),
    natcashEnabled: z.boolean().default(true),
  }).default({
    certificate: true,
    lifetimeAccess: true,
    guaranteeDays: 7,
    moncashEnabled: true,
    natcashEnabled: true,
  }),
  modules: z.array(
    z.object({
      id: z.string().optional(),
      titleFr: z.string().min(1, "Le titre du module est requis."),
      titleHt: z.string().optional().default(""),
      position: z.number().int().default(0),
      lessons: z.array(
        z.object({
          id: z.string().optional(),
          titleFr: z.string().min(1, "Le titre de la leçon est requis."),
          titleHt: z.string().optional().default(""),
          descriptionFr: z.string().optional().default(""),
          descriptionHt: z.string().optional().default(""),
          position: z.number().int().default(0),
          videoId: z.string().optional().default(""),
          durationSec: z.number().int().default(0),
          isFreePreview: z.boolean().default(false),
          resources: z.array(
            z.object({
              id: z.string().optional(),
              name: z.string().min(1),
              fileUrl: z.string().min(1),
            })
          ).default([]),
        })
      ).default([]),
    })
  ).default([]),
});

/**
 * Validates requirements for publishing a course.
 * Rule: A course cannot be published without title FR, price > 0, cover image, and at least one lesson.
 */
export function validateCourseForPublish(data: {
  titleFr: string;
  priceHtg: number;
  coverUrl: string;
  modules: Array<{ lessons?: any[] }>;
}): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.titleFr || data.titleFr.trim().length < 3) {
    errors.push("Le titre de la formation en français est obligatoire (minimum 3 caractères).");
  }

  if (typeof data.priceHtg !== "number" || data.priceHtg <= 0) {
    errors.push("Le prix de vente doit être strictement supérieur à 0 HTG pour être publié.");
  }

  if (!data.coverUrl || data.coverUrl.trim().length === 0) {
    errors.push("Une image de couverture est obligatoire pour publier la formation.");
  }

  const totalLessons = data.modules.reduce(
    (acc, m) => acc + (m.lessons ? m.lessons.length : 0),
    0
  );

  if (data.modules.length === 0 || totalLessons === 0) {
    errors.push("La formation doit contenir au moins un module et au moins une leçon avant d'être publiée.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Converts a string to a clean URL-friendly slug.
 */
export function slugify(text: string): string {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "") // Remove all non-word chars
    .replace(/--+/g, "-"); // Replace multiple - with single -
}
