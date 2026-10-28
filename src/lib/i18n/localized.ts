import type { Locale } from "@/i18n/routing";

/**
 * Helper to retrieve localized content from database records with `_fr` and `_ht` column suffixes.
 * Falls back to French (`_fr`) if the Haitian Creole (`_ht`) string is empty or undefined.
 *
 * @example
 * localized(course, 'title', 'ht') // returns course.title_ht || course.title_fr
 */
export function localized<
  T extends Record<string, any>,
  K extends string
>(
  row: T | null | undefined,
  field: K,
  locale: Locale | string = "fr"
): string {
  if (!row) return "";

  const frKey = `${field}_fr`;
  const htKey = `${field}_ht`;

  const frValue = typeof row[frKey] === "string" ? row[frKey].trim() : "";
  const htValue = typeof row[htKey] === "string" ? row[htKey].trim() : "";

  if (locale === "ht") {
    return htValue || frValue;
  }

  return frValue || htValue;
}
