import { checkMessageModeration, maskPhoneNumber } from "../src/lib/moderation/index.ts";

console.log("=== RUNNING MODERATION ENGINE UNIT TESTS ===");

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${testName}`);
    failed++;
  }
}

// 1. Phone number test cases (should be BLOCKED)
const blockedPhoneCases = [
  { text: "+509 37 12 34 56", desc: "Format 1: +509 with 2-digit groups" },
  { text: "+50937123456", desc: "Format 2: +509 compact 8 digits" },
  { text: "509 3712 3456", desc: "Format 3: 509 without plus" },
  { text: "37 12 34 56", desc: "Format 4: 8 digits separated by spaces" },
  { text: "48-99-00-11", desc: "Format 5: 8 digits separated by dashes" },
  { text: "3.7.1.2.3.4.5.6", desc: "Format 6: Digits separated by dots" },
  { text: "3 7 1 2 3 4 5 6", desc: "Format 7: Each digit separated by spaces" },
  { text: "+1 305 555 1234", desc: "Format 8: International US number (+1)" },
  { text: "+33 6 12 34 56 78", desc: "Format 9: International French number (+33)" },
  { text: "trois sept un deux trois quatre cinq six", desc: "Format 10: Spelled out digits in French" },
  { text: "twa sèt en de twa kat senk sis", desc: "Format 11: Spelled out digits in Creole" },
];

for (const tc of blockedPhoneCases) {
  const res = checkMessageModeration(tc.text);
  assert(res.blocked === true && res.reason === "phone", `Phone blocked - ${tc.desc}`);
}

// 2. Off-platform / WhatsApp invitations (should be BLOCKED)
const blockedOffplatformCases = [
  { text: "écrivez-moi sur WhatsApp s'il vous plaît", desc: "French: écrivez-moi sur WhatsApp" },
  { text: "ekri m sou WhatsApp pou plis info", desc: "Creole: ekri m sou WhatsApp" },
  { text: "contactez-moi sur WhatsApp", desc: "French: contactez-moi sur WhatsApp" },
  { text: "mon numéro WhatsApp c'est sur mon profil", desc: "French: mon numéro WhatsApp" },
  { text: "rejoins le groupe wa.me/50937123456", desc: "Direct link wa.me/" },
  { text: "ajoute moi w.h.a.t.s.a.p.p", desc: "Obfuscated w.h.a.t.s.a.p.p" },
  { text: "ekri m sou zap kounye a", desc: "Creole: ekri m sou zap" },
  { text: "ekri m sou wasap", desc: "Creole: ekri m sou wasap" },
  { text: "rejoins moi sur Telegram t.me/moncanal", desc: "Telegram invite" },
];

for (const tc of blockedOffplatformCases) {
  const res = checkMessageModeration(tc.text);
  assert(res.blocked === true && res.reason === "offplatform", `Offplatform blocked - ${tc.desc}`);
}

// 3. Legitimate messages / False positives (should be ALLOWED)
const allowedCases = [
  { text: "Le cours coûte 2 500 HTG pour les membres.", desc: "Price with spaces: 2 500 HTG" },
  { text: "J'ai payé 10 000 Gourdes par MonCash.", desc: "Price: 10 000 Gourdes" },
  { text: "L'abonnement est à $50 USD par mois.", desc: "Price: $50 USD" },
  { text: "La constitution de 1804 et les défis de 2026.", desc: "Years: 1804 and 2026" },
  { text: "Regarde le chapitre 3 et la leçon 12.", desc: "Chapter and lesson numbers" },
  { text: "J'ai terminé le module 4 en 15 min.", desc: "Module number and duration" },
  { text: "La vidéo dure 2 h 30 et j'ai complété 100%.", desc: "Hours and percentage" },
  { text: "Bonjour formateur, j'ai une question sur l'exercice.", desc: "Normal polite message" },
  { text: "Mèsi anpil pou fòmasyon an, li vrèman ede m !", desc: "Normal Creole message" },
];

for (const tc of allowedCases) {
  const res = checkMessageModeration(tc.text);
  assert(res.blocked === false, `Allowed legitimate message - ${tc.desc}`);
}

// 4. Masking test
const masked = maskPhoneNumber("+509 37 12 34 56");
assert(masked.includes("••") && masked.includes("34 56"), "Phone masking hides digits correctly");

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
