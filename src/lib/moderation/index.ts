/**
 * Faro School Platform Moderation Engine
 * 
 * Provides pure, unit-tested detection for:
 * 1. Phone numbers (Haitian formats, international numbers, spaced/dotted/dashed digits, letter-spelled digits)
 * 2. Off-platform contact invitations (WhatsApp, wa.me, Telegram, Signal, etc.)
 * 
 * Includes false-positive protections for:
 * - Prices: "2 500 HTG", "5 000 Gourdes", "$50 USD"
 * - Years: "2026", "2025", "1804"
 * - Lessons/Modules: "Chapitre 3", "Leçon 12", "Module 4"
 * - Durations: "15 min", "2 h 30", "10h"
 * - Percentages: "100%", "50%"
 */

export interface ModerationResult {
  blocked: boolean;
  reason?: "phone" | "offplatform";
  maskedExcerpt?: string;
  noticeFr?: string;
  noticeHt?: string;
}

// Editable off-platform keywords and trigger phrases
export const OFFPLATFORM_PHRASES = [
  // French phrases
  "ecrivez moi sur whatsapp",
  "ecrivez-moi sur whatsapp",
  "contactez moi sur whatsapp",
  "contactez-moi sur whatsapp",
  "rejoins moi sur whatsapp",
  "rejoins-moi sur whatsapp",
  "viens sur whatsapp",
  "ecris moi sur whatsapp",
  "mon numero whatsapp",
  "mon whatsapp",
  "sur mon whatsapp",
  "mon numero est",
  "mon numero c'est",
  "appelle moi au",
  "appelez moi au",
  
  // Haitian Creole phrases
  "ekri m sou whatsapp",
  "ekri mwen sou whatsapp",
  "kontakte m sou whatsapp",
  "kontakte mwen sou whatsapp",
  "vin sou whatsapp",
  "vinn sou whatsapp",
  "rele m sou whatsapp",
  "rele mwen sou whatsapp",
  "nimewo whatsapp mwen",
  "nimewo m se",
  "nimewo mwen se",
  "ekri m sou zap",
  "ekri m sou wasap",
  "rele m sou",
  "kontakte m sou zap",

  // Direct links and handles
  "wa.me/",
  "api.whatsapp.com",
  "chat.whatsapp.com",
  "t.me/",
  "telegram.me",
];

// Spelled-out numbers dictionary in French and Haitian Creole
const WORD_TO_DIGIT: Record<string, string> = {
  // French
  zero: "0",
  un: "1",
  une: "1",
  deux: "2",
  trois: "3",
  quatre: "4",
  cinq: "5",
  six: "6",
  sept: "7",
  huit: "8",
  neuf: "9",
  dix: "10",
  // Creole
  zewo: "0",
  en: "1",
  de: "2",
  twa: "3",
  kat: "4",
  senk: "5",
  sis: "6",
  set: "7",
  sèt: "7",
  uit: "8",
  wit: "8",
  nef: "9",
  nèf: "9",
  dis: "10",
};

/**
 * Normalizes text for moderation detection.
 * - Lowercases
 * - Strips diacritics
 * - Removes zero-width characters and invisible spaces
 */
export function normalizeText(input: string): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // strip zero-width chars
    .replace(/[\t\r\n]+/g, " ");
}

/**
 * Masks a detected phone number, e.g. "+509 37 12 34 56" -> "+509 •• •• 34 56"
 */
export function maskPhoneNumber(phoneRaw: string): string {
  const digitsOnly = phoneRaw.replace(/\D/g, "");
  if (digitsOnly.length <= 4) {
    return "••••";
  }
  const lastFour = digitsOnly.slice(-4);
  const prefix = digitsOnly.startsWith("509") ? "+509 " : "";
  return `${prefix}•• •• ${lastFour.slice(0, 2)} ${lastFour.slice(2)}`;
}

/**
 * Pure detector for phone numbers and off-platform attempts.
 */
export function checkMessageModeration(rawText: string): ModerationResult {
  if (!rawText || typeof rawText !== "string") {
    return { blocked: false };
  }

  const clean = normalizeText(rawText);

  // -------------------------------------------------------------
  // 1. CHECK OFF-PLATFORM / WHATSAPP PHRASES
  // -------------------------------------------------------------
  // Check obfuscated variants: w.h.a.t.s.a.p.p, w-h-a-t-s-a-p-p, etc.
  const collapsedText = clean.replace(/[\s._\-*/\\|]+/g, "");
  if (
    collapsedText.includes("whatsapp") ||
    collapsedText.includes("watshap") ||
    collapsedText.includes("wasap") ||
    collapsedText.includes("watsap") ||
    collapsedText.includes("wa.me")
  ) {
    // If text contains whatsapp keyword or link
    return {
      blocked: true,
      reason: "offplatform",
      maskedExcerpt: "Invitation WhatsApp / lien externe",
      noticeFr:
        "Les numéros de téléphone et les invitations vers WhatsApp ne sont pas autorisés. Ton message n'a pas été envoyé.",
      noticeHt:
        "Nimewo telefòn ak envitasyon sou WhatsApp pa otorize. Mesaj ou a pa te voye.",
    };
  }

  // Check known trigger phrases
  for (const phrase of OFFPLATFORM_PHRASES) {
    if (clean.includes(phrase)) {
      return {
        blocked: true,
        reason: "offplatform",
        maskedExcerpt: `${phrase.slice(0, 15)}...`,
        noticeFr:
          "Les numéros de téléphone et les invitations vers WhatsApp ne sont pas autorisés. Ton message n'a pas été envoyé.",
        noticeHt:
          "Nimewo telefòn ak envitasyon sou WhatsApp pa otorize. Mesaj ou a pa te voye.",
      };
    }
  }

  // Check generic Telegram / Signal invitations
  if (
    clean.includes("t.me/") ||
    clean.includes("telegram") ||
    clean.includes("signal.me") ||
    /\b(ekri|kontakte|rele|ecris|ecrivez|contactez)\s+(m|mwen|moi)\s+sou\s+(telegram|signal|zap)\b/i.test(
      clean
    )
  ) {
    return {
      blocked: true,
      reason: "offplatform",
      maskedExcerpt: "Invitation messagerie externe",
      noticeFr:
        "Les numéros de téléphone et les invitations vers WhatsApp ne sont pas autorisés. Ton message n'a pas été envoyé.",
      noticeHt:
        "Nimewo telefòn ak envitasyon sou WhatsApp pa otorize. Mesaj ou a pa te voye.",
    };
  }

  // -------------------------------------------------------------
  // 2. CHECK SPELLED-OUT PHONE NUMBERS (words in French / Creole)
  // -------------------------------------------------------------
  const words = clean.split(/[\s,.;:!?/\-]+/).filter(Boolean);
  let consecutiveNumberWords = 0;
  const collectedSpelledDigits: string[] = [];

  for (const w of words) {
    if (WORD_TO_DIGIT[w] !== undefined) {
      consecutiveNumberWords++;
      collectedSpelledDigits.push(WORD_TO_DIGIT[w]);
    } else {
      // If we accumulated >= 7 spelled-out digits, it's a spelled out phone number!
      if (consecutiveNumberWords >= 7) {
        break;
      }
      consecutiveNumberWords = 0;
      collectedSpelledDigits.length = 0;
    }
  }

  if (consecutiveNumberWords >= 7) {
    const rawDigits = collectedSpelledDigits.join("");
    return {
      blocked: true,
      reason: "phone",
      maskedExcerpt: maskPhoneNumber(rawDigits),
      noticeFr:
        "Les numéros de téléphone et les invitations vers WhatsApp ne sont pas autorisés. Ton message n'a pas été envoyé.",
      noticeHt:
        "Nimewo telefòn ak envitasyon sou WhatsApp pa otorize. Mesaj ou a pa te voye.",
    };
  }

  // -------------------------------------------------------------
  // 3. CHECK NUMERIC PHONE NUMBERS
  // -------------------------------------------------------------
  // We need to protect legitimate false positives:
  // - "2 500 HTG", "10 000 Gourdes", "50 USD", "$100"
  // - Years: 2024, 2025, 2026, 1804
  // - Chapter/lesson: "Chapitre 3", "Leçon 12", "Module 4"
  // - Durations: "15 min", "2 h 30", "10h"
  // - Time: "08:30", "14h45"

  // First, mask out safe currency/price expressions before phone scanning
  let textForPhoneScan = clean
    // Prices like 2 500 HTG, 10 000 goud, $50, 150 USD
    .replace(/\b\d{1,4}(\s\d{3})*(\s*(htg|gourdes|goud|usd|eur|\$|dollars))\b/gi, " [PRICE] ")
    // Years in range 1800-2099
    .replace(/\b(18|19|20)\d{2}\b/g, " [YEAR] ")
    // Chapter / lesson / module references
    .replace(/\b(chapitre|lecon|module|video|partie|paj|page)\s+\d{1,3}\b/gi, " [CHAPTER] ")
    // Time / durations
    .replace(/\b\d{1,2}\s*(h|min|sec|seg)\s*(\d{1,2})?\b/gi, " [TIME] ")
    .replace(/\b\d{1,2}:\d{2}\b/g, " [TIME] ")
    // Percentages
    .replace(/\b\d{1,3}\s*%\b/g, " [PERCENT] ");

  // Patterns for Haitian phone numbers:
  // Haitian mobile numbers are 8 digits starting with 3, 4, or 5 (e.g. 3712-3456, 4899-0011, etc.)
  // Often prefixed with +509 or 509
  // Forms:
  // - +509 37 12 34 56
  // - 509 37123456
  // - 37 12 34 56
  // - 3712-3456
  // - 3.7.1.2.3.4.5.6
  // - 37 123 456

  // Detect explicit +509 or 509 prefix followed by 8 digits
  const haitiFullRegex = /(?:\+?509)[\s.\-_/]*([345]\d)[\s.\-_/]*(\d{2})[\s.\-_/]*(\d{2})[\s.\-_/]*(\d{2})/i;
  const matchHaitiFull = textForPhoneScan.match(haitiFullRegex);
  if (matchHaitiFull) {
    return {
      blocked: true,
      reason: "phone",
      maskedExcerpt: maskPhoneNumber(matchHaitiFull[0]),
      noticeFr:
        "Les numéros de téléphone et les invitations vers WhatsApp ne sont pas autorisés. Ton message n'a pas été envoyé.",
      noticeHt:
        "Nimewo telefòn ak envitasyon sou WhatsApp pa otorize. Mesaj ou a pa te voye.",
    };
  }

  // Detect 8-digit Haitian national format (starting with 3, 4, or 5)
  // e.g. 37 12 34 56 or 48-12-34-56 or 37123456
  const haitiLocalRegex = /\b([345]\d)[\s.\-_/]*(\d{2})[\s.\-_/]*(\d{2})[\s.\-_/]*(\d{2})\b/;
  const matchHaitiLocal = textForPhoneScan.match(haitiLocalRegex);
  if (matchHaitiLocal) {
    return {
      blocked: true,
      reason: "phone",
      maskedExcerpt: maskPhoneNumber(matchHaitiLocal[0]),
      noticeFr:
        "Les numéros de téléphone et les invitations vers WhatsApp ne sont pas autorisés. Ton message n'a pas été envoyé.",
      noticeHt:
        "Nimewo telefòn ak envitasyon sou WhatsApp pa otorize. Mesaj ou a pa te voye.",
    };
  }

  // Detect digits with aggressive single-character spacing: "3 7 1 2 3 4 5 6" or "3.7.1.2.3.4.5.6"
  const spacedDigitsRegex = /\b([345])[\s.\-_/]+(\d)[\s.\-_/]+(\d)[\s.\-_/]+(\d)[\s.\-_/]+(\d)[\s.\-_/]+(\d)[\s.\-_/]+(\d)[\s.\-_/]+(\d)\b/;
  const matchSpaced = textForPhoneScan.match(spacedDigitsRegex);
  if (matchSpaced) {
    return {
      blocked: true,
      reason: "phone",
      maskedExcerpt: maskPhoneNumber(matchSpaced[0]),
      noticeFr:
        "Les numéros de téléphone et les invitations vers WhatsApp ne sont pas autorisés. Ton message n'a pas été envoyé.",
      noticeHt:
        "Nimewo telefòn ak envitasyon sou WhatsApp pa otorize. Mesaj ou a pa te voye.",
    };
  }

  // Detect international phone numbers: +1 xxx xxx xxxx, +33 x xx xx xx xx, etc.
  const intlRegex = /\+(?:1|33|44|34|49|55|1809|1829|1849)[\s.\-_/]*\d{1,4}[\s.\-_/]*\d{2,4}[\s.\-_/]*\d{2,4}/;
  const matchIntl = textForPhoneScan.match(intlRegex);
  if (matchIntl) {
    return {
      blocked: true,
      reason: "phone",
      maskedExcerpt: maskPhoneNumber(matchIntl[0]),
      noticeFr:
        "Les numéros de téléphone et les invitations vers WhatsApp ne sont pas autorisés. Ton message n'a pas été envoyé.",
      noticeHt:
        "Nimewo telefòn ak envitasyon sou WhatsApp pa otorize. Mesaj ou a pa te voye.",
    };
  }

  // Check general sequence of 8 to 12 consecutive digits that isn't a price or year
  const generalDigits = textForPhoneScan.match(/\b\d{8,12}\b/);
  if (generalDigits) {
    return {
      blocked: true,
      reason: "phone",
      maskedExcerpt: maskPhoneNumber(generalDigits[0]),
      noticeFr:
        "Les numéros de téléphone et les invitations vers WhatsApp ne sont pas autorisés. Ton message n'a pas été envoyé.",
      noticeHt:
        "Nimewo telefòn ak envitasyon sou WhatsApp pa otorize. Mesaj ou a pa te voye.",
    };
  }

  return { blocked: false };
}
