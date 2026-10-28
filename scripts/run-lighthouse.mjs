import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";

const PORT = 3009;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function waitForServer(url, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  console.log("Starting Next.js production server on port " + PORT + "...");
  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    shell: true,
    stdio: "inherit",
    env: { ...process.env, PORT: String(PORT) },
  });

  try {
    const ready = await waitForServer(`${BASE_URL}/fr`);
    if (!ready) {
      throw new Error("Server failed to respond within 20s");
    }
    console.log("Server ready! Running Lighthouse mobile audits...");

    const routes = [
      { name: "Page 01 - Landing (/[locale])", path: "/fr" },
      { name: "Page 02 - Catalog (/[locale]/formations)", path: "/fr/formations" },
      { name: "Page 03 - Detail (/[locale]/formations/[slug])", path: "/fr/formations/marketing-digital" },
    ];

    const reportsDir = path.resolve("./.lighthouse-reports");
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const summary = [];

    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      const targetUrl = `${BASE_URL}${route.path}`;
      const reportFile = path.join(reportsDir, `page-0${i + 1}.json`);

      console.log(`\nAuditing ${route.name} at ${targetUrl}...`);
      try {
        execSync(
          `npx lighthouse "${targetUrl}" --chrome-flags="--headless --no-sandbox" --form-factor=mobile --output=json --output-path="${reportFile}" --quiet`,
          { stdio: "inherit", env: { ...process.env, CHROME_PATH: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" } }
        );

        if (fs.existsSync(reportFile)) {
          const raw = JSON.parse(fs.readFileSync(reportFile, "utf-8"));
          const cats = raw.categories;
          summary.push({
            page: route.name,
            performance: Math.round((cats.performance?.score || 0) * 100),
            accessibility: Math.round((cats.accessibility?.score || 0) * 100),
            bestPractices: Math.round((cats["best-practices"]?.score || 0) * 100),
            seo: Math.round((cats.seo?.score || 0) * 100),
          });
        }
      } catch (err) {
        console.error(`Audit failed for ${route.name}:`, err.message);
      }
    }

    console.log("\n================ LIGHTHOUSE MOBILE AUDIT SUMMARY ================");
    console.table(summary);
    fs.writeFileSync(path.join(reportsDir, "summary.json"), JSON.stringify(summary, null, 2));
  } finally {
    console.log("\nStopping server...");
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /pid ${server.pid} /T /F`);
      } else {
        server.kill("SIGTERM");
      }
    } catch {}
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
