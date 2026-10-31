/**
 * Word filter for Faro School Community.
 * Covers abusive terms, hate speech, scam patterns, and harassment in French and Haitian Creole.
 */

const BLOCKED_WORDS: string[] = [
  // French abusive / slurs
  "connard",
  "salope",
  "bâtard",
  "batard",
  "enculé",
  "encule",
  "pute",
  "nique",
  "merde",
  "trouduc",
  // Haitian Creole offensive terms
  "madichon",
  "tenten",
  "kokat",
  "koko",
  "baba",
  "kriye",
  "salopri",
  "fatra",
  "volè",
  "vole",
  "kouto",
  "kaka",
  // Common spam / phishing patterns
  "whatsapp.com/chat/free-money",
  "t.me/freecrypto",
  "gagner argent facile sans travail",
  "investissez 100 goudes gagnez 10000",
];

const FLAGGED_WORDS: string[] = [
  "argent gratuit",
  "lajan gratis",
  "doubler vos goudes",
  "pyramide",
  "ponzi",
  "hack",
  "pirater",
];

export interface ProfanityCheckResult {
  blocked: boolean;
  flagged: boolean;
  reason?: string;
}

export function checkProfanity(text: string, custom: string[] = []): ProfanityCheckResult {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const allBlocked = Array.from(new Set([...BLOCKED_WORDS, ...custom]));

  for (const word of allBlocked) {
    const normalizedWord = word
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    
    // Check whole word or substring for links/phrases
    const escaped = normalizedWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(normalized) || (word.includes(" ") && normalized.includes(normalizedWord))) {
      return {
        blocked: true,
        flagged: true,
        reason: "Le message contient des propos contraires aux règles de respect et de sécurité de la communauté.",
      };
    }
  }

  for (const word of FLAGGED_WORDS) {
    if (normalized.includes(word)) {
      return {
        blocked: false,
        flagged: true,
        reason: "Terme sensible détecté pour vérification par les modérateurs.",
      };
    }
  }

  return { blocked: false, flagged: false };
}

/**
 * Checks if a message contains external URLs.
 */
export function containsUrl(text: string): boolean {
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.[a-zA-Z]{2,}\/[^\s]*)/i;
  return urlRegex.test(text);
}
