import fs from "fs";
import path from "path";

function findHexInDir(dir, matches = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findHexInDir(fullPath, matches);
    } else if (/\.(tsx|ts|jsx|js|css)$/.test(entry.name)) {
      if (entry.name === "tokens.css") continue;
      const content = fs.readFileSync(fullPath, "utf8");
      const hexRegex = /#([0-9a-fA-F]{3,8})\b/g;
      let match;
      while ((match = hexRegex.exec(content)) !== null) {
        matches.push({
          file: fullPath,
          match: match[0],
          line: content.substring(0, match.index).split("\n").length,
        });
      }
    }
  }
  return matches;
}

const hexes = findHexInDir("src");
console.log(`Found ${hexes.length} hardcoded hex matches:`);
for (const h of hexes) {
  console.log(`  ${h.file}:${h.line} -> ${h.match}`);
}
