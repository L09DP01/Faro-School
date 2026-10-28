import fs from "fs";
import path from "path";

function getAllKeys(obj: any, prefix = ""): string[] {
  let keys: string[] = [];
  for (const k of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === "object" && obj[k] !== null && !Array.isArray(obj[k])) {
      keys = keys.concat(getAllKeys(obj[k], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

console.log("=== FARO SCHOOL: i18n PARITY AUDIT ===");

const fr = JSON.parse(fs.readFileSync(path.resolve("src/messages/fr.json"), "utf-8"));
const ht = JSON.parse(fs.readFileSync(path.resolve("src/messages/ht.json"), "utf-8"));

const frKeys = new Set(getAllKeys(fr));
const htKeys = new Set(getAllKeys(ht));

const missingInHt: string[] = [];
const missingInFr: string[] = [];

for (const k of frKeys) {
  if (!htKeys.has(k)) {
    missingInHt.push(k);
  }
}

for (const k of htKeys) {
  if (!frKeys.has(k)) {
    missingInFr.push(k);
  }
}

console.log(`Total French keys: ${frKeys.size}`);
console.log(`Total Haitian Creole keys: ${htKeys.size}`);

if (missingInHt.length > 0) {
  console.error(`\n❌ Keys missing in ht.json (${missingInHt.length}):`);
  missingInHt.slice(0, 20).forEach((k) => console.error(`  - ${k}`));
  if (missingInHt.length > 20) console.error(`  ... and ${missingInHt.length - 20} more`);
} else {
  console.log("✓ Zero keys missing in ht.json!");
}

if (missingInFr.length > 0) {
  console.error(`\n❌ Keys missing in fr.json (${missingInFr.length}):`);
  missingInFr.slice(0, 20).forEach((k) => console.error(`  - ${k}`));
  if (missingInFr.length > 20) console.error(`  ... and ${missingInFr.length - 20} more`);
} else {
  console.log("✓ Zero keys missing in fr.json!");
}

if (missingInHt.length > 0 || missingInFr.length > 0) {
  process.exit(1);
} else {
  console.log("\nALL i18n KEYS PERFECTLY MATCH 100%!");
}
