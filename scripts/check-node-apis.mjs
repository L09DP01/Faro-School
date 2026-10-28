import fs from "fs";

const res = [];
function search(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = dir + "/" + f.name;
    if (f.isDirectory() && !p.includes("node_modules") && !p.includes(".next")) {
      search(p);
    } else if (f.isFile() && (f.name.endsWith(".ts") || f.name.endsWith(".tsx"))) {
      const c = fs.readFileSync(p, "utf8");
      if (
        c.includes('from "fs"') ||
        c.includes("from 'fs'") ||
        c.includes('from "child_process"') ||
        c.includes("from 'child_process'")
      ) {
        res.push(p);
      }
    }
  }
}

search("src");
console.log("Node-only imports in src:", res);
