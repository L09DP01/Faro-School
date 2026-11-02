import type { ConversationStatus } from "@/lib/messaging/types";

/** Keep tiny nonzero estimates visible without exposing unbounded decimals. */
export function formatAiDailyCost(value: number, locale: string): string {
  if (!Number.isFinite(value) || value < 0) return "—";
  const format = new Intl.NumberFormat(locale === "ht" ? "ht-HT" : "fr-FR", {
    style: "currency", currency: "USD", currencyDisplay: "code",
    minimumFractionDigits: 2, maximumFractionDigits: 4,
  });
  return value > 0 && value < 0.0001 ? `< ${format.format(0.0001)}` : format.format(value);
}

export function conversationStatusLabel(status: ConversationStatus, locale: string): string {
  const labels: Record<ConversationStatus, [string, string]> = {
    open: ["Ouvert", "Ouvè"],
    ai_handling: ["Pris en charge par l’IA", "IA ap okipe l"],
    waiting_staff: ["En attente d’un intervenant", "Ap tann yon entèvenan"],
    staff_replied: ["Réponse envoyée", "Repons voye"],
    closed: ["Clôturé", "Fèmen"],
  };
  return labels[status]?.[locale === "ht" ? 1 : 0] ?? (locale === "ht" ? "Endisponib" : "Indisponible");
}
