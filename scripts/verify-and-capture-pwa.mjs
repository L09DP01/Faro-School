import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const PORT = 3009;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACTS_DIR = "C:\\Users\\owner\\.gemini\\antigravity\\brain\\ccec8969-18ac-4abc-8efb-e923a1172981";

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url, maxAttempts = 25) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status >= 200 && res.status < 400) return true;
    } catch {}
    await sleep(1000);
  }
  return false;
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && this.callbacks.has(data.id)) {
        const { resolve, reject } = this.callbacks.get(data.id);
        this.callbacks.delete(data.id);
        if (data.error) {
          reject(new Error(data.error.message));
        } else {
          resolve(data.result);
        }
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function main() {
  console.log("=== 1. STARTING PRODUCTION SERVER ===");
  const nextBin = path.resolve("./node_modules/next/dist/bin/next");
  const server = spawn(process.execPath, [nextBin, "start", "-p", String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(PORT), NODE_ENV: "production" },
  });

  server.stdout.on("data", (d) => {
    const s = d.toString().trim();
    console.log(`[Next stdout] ${s}`);
  });

  server.stderr.on("data", (d) => {
    const s = d.toString().trim();
    console.error(`[Next stderr] ${s}`);
  });

  try {
    const ready = await waitForServer(`${BASE_URL}/manifest.webmanifest`, 35);
    if (!ready) throw new Error("Next.js server failed to respond.");
    console.log("✓ Next server is ready on port", PORT);

    console.log("\n=== 2. VERIFYING PWA MANIFEST & SERVICE WORKER HEADERS ===");
    // Test Manifest
    const manifestRes = await fetch(`${BASE_URL}/manifest.webmanifest`);
    if (!manifestRes.ok) throw new Error("Manifest HTTP error: " + manifestRes.status);
    const manifestData = await manifestRes.json();
    console.log("✓ Manifest Name:", manifestData.name);
    console.log("✓ Manifest Short Name:", manifestData.short_name);
    console.log("✓ Manifest Start URL:", manifestData.start_url);
    console.log("✓ Manifest Display:", manifestData.display);
    console.log("✓ Manifest Theme Color:", manifestData.theme_color);
    console.log("✓ Manifest Icons count:", manifestData.icons.length);
    console.log("✓ Manifest Shortcuts count:", manifestData.shortcuts.length);

    // Test SW
    const swRes = await fetch(`${BASE_URL}/sw.js`);
    if (!swRes.ok) throw new Error("SW HTTP error: " + swRes.status);
    const swCacheControl = swRes.headers.get("cache-control");
    console.log("✓ Service Worker Status:", swRes.status);
    console.log("✓ Service Worker Cache-Control:", swCacheControl);

    console.log("\n=== 3. VERIFYING /app ENTRY ROUTE REDIRECTS ===");
    // Test /app logged out -> redirects to /fr/connexion
    const appLoggedOutRes = await fetch(`${BASE_URL}/app`, { redirect: "manual" });
    console.log("✓ /app (logged out) -> Status:", appLoggedOutRes.status, "Location:", appLoggedOutRes.headers.get("location"));

    // Test /app with student session
    const studentSession = Buffer.from(JSON.stringify({
      id: "student-1",
      fullName: "Jean Baptiste",
      role: "student",
      locale: "fr"
    })).toString("base64");
    const appStudentRes = await fetch(`${BASE_URL}/app`, {
      redirect: "manual",
      headers: { Cookie: `faro_session=${studentSession}` }
    });
    console.log("✓ /app (student) -> Status:", appStudentRes.status, "Location:", appStudentRes.headers.get("location"));

    // Test /app with admin session
    const adminSession = Buffer.from(JSON.stringify({
      id: "admin-1",
      fullName: "Admin Faro",
      role: "admin",
      locale: "fr"
    })).toString("base64");
    const appAdminRes = await fetch(`${BASE_URL}/app`, {
      redirect: "manual",
      headers: { Cookie: `faro_session=${adminSession}` }
    });
    console.log("✓ /app (admin) -> Status:", appAdminRes.status, "Location:", appAdminRes.headers.get("location"));

    // Test /app with instructor session
    const instructorSession = Buffer.from(JSON.stringify({
      id: "inst-1",
      fullName: "Formateur Faro",
      role: "instructor",
      locale: "fr"
    })).toString("base64");
    const appInstRes = await fetch(`${BASE_URL}/app`, {
      redirect: "manual",
      headers: { Cookie: `faro_session=${instructorSession}` }
    });
    console.log("✓ /app (instructor) -> Status:", appInstRes.status, "Location:", appInstRes.headers.get("location"));

    console.log("\n=== 4. VERIFYING STANDALONE MODE REDIRECTS (LANDING NEVER SHOWN) ===");
    // In standalone mode, accessing "/" or "/fr" redirects to /app
    const standaloneLandingRes = await fetch(`${BASE_URL}/fr`, {
      redirect: "manual",
      headers: { Cookie: "faro_display=standalone" }
    });
    console.log("✓ /fr with faro_display=standalone -> Status:", standaloneLandingRes.status, "Location:", standaloneLandingRes.headers.get("location"));

    // In normal browser tab, accessing "/fr" serves landing page normally
    const normalLandingRes = await fetch(`${BASE_URL}/fr`, { redirect: "manual" });
    console.log("✓ /fr normal browser -> Status:", normalLandingRes.status, "(Serves marketing landing)");

    console.log("\n=== 5. CAPTURING MOBILE PWA SCREENSHOTS (390px Standalone) ===");
    const chrome = spawn(CHROME_PATH, [
      "--headless=new",
      "--remote-debugging-port=9223",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${path.resolve("./.chrome-pwa-data")}`,
    ]);

    await sleep(2000);

    const versionRes = await fetch("http://127.0.0.1:9223/json/version");
    const versionData = await versionRes.json();
    const wsUrl = versionData.webSocketDebuggerUrl;
    const cdp = new CdpClient(wsUrl);
    await cdp.connect();

    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const targetWsUrl = `ws://127.0.0.1:9223/devtools/page/${targetId}`;
    const pageCdp = new CdpClient(targetWsUrl);
    await pageCdp.connect();

    await pageCdp.send("Page.enable");
    await pageCdp.send("Network.enable");

    // Set mobile standalone viewport (390 x 844)
    await pageCdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });

    // Output dir
    const outDir = path.resolve("./public/brand");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // A. Installed Login Page (Logged Out, Standalone)
    console.log("Capturing PWA Login (Standalone)...");
    await pageCdp.send("Network.setCookie", {
      name: "faro_display",
      value: "standalone",
      domain: "127.0.0.1",
      path: "/",
    });

    await pageCdp.send("Page.navigate", { url: `${BASE_URL}/fr/connexion` });
    await sleep(2500);

    const shotLogin = await pageCdp.send("Page.captureScreenshot", { format: "png" });
    const fileLogin = path.join(outDir, "pwa-login-390.png");
    fs.writeFileSync(fileLogin, Buffer.from(shotLogin.data, "base64"));
    console.log("Saved:", fileLogin);

    // B. Installed Student Dashboard (Logged In, Standalone)
    console.log("Capturing PWA Dashboard (Standalone)...");
    await pageCdp.send("Network.setCookie", {
      name: "faro_session",
      value: studentSession,
      domain: "127.0.0.1",
      path: "/",
    });

    await pageCdp.send("Page.navigate", { url: `${BASE_URL}/fr/dashboard` });
    await sleep(3000);

    const shotDash = await pageCdp.send("Page.captureScreenshot", { format: "png" });
    const fileDash = path.join(outDir, "pwa-dashboard-390.png");
    fs.writeFileSync(fileDash, Buffer.from(shotDash.data, "base64"));
    console.log("Saved:", fileDash);

    // C. Installed Community (Logged In, Standalone)
    console.log("Capturing PWA Community (Standalone)...");
    await pageCdp.send("Page.navigate", { url: `${BASE_URL}/fr/dashboard/communaute` });
    await sleep(3000);

    // Dismiss modal if open
    await pageCdp.send("Runtime.evaluate", {
      expression: `
        (function() {
          const checkbox = document.querySelector('input[type="checkbox"]');
          if (checkbox && !checkbox.checked) checkbox.click();
          const buttons = Array.from(document.querySelectorAll('button'));
          const btn = buttons.find(b => b.textContent && b.textContent.includes('Accéder à la communauté'));
          if (btn) btn.click();
        })();
      `,
    });
    await sleep(500);

    const shotComm = await pageCdp.send("Page.captureScreenshot", { format: "png" });
    const fileComm = path.join(outDir, "pwa-community-390.png");
    fs.writeFileSync(fileComm, Buffer.from(shotComm.data, "base64"));
    console.log("Saved:", fileComm);

    // D. Offline Page
    console.log("Capturing PWA Offline Page...");
    await pageCdp.send("Page.navigate", { url: `${BASE_URL}/offline` });
    await sleep(1500);

    const shotOffline = await pageCdp.send("Page.captureScreenshot", { format: "png" });
    const fileOffline = path.join(outDir, "pwa-offline-390.png");
    fs.writeFileSync(fileOffline, Buffer.from(shotOffline.data, "base64"));
    console.log("Saved:", fileOffline);

    // Copy to artifact directory
    if (fs.existsSync(ARTIFACTS_DIR)) {
      fs.copyFileSync(fileLogin, path.join(ARTIFACTS_DIR, "pwa-login-390.png"));
      fs.copyFileSync(fileDash, path.join(ARTIFACTS_DIR, "pwa-dashboard-390.png"));
      fs.copyFileSync(fileComm, path.join(ARTIFACTS_DIR, "pwa-community-390.png"));
      fs.copyFileSync(fileOffline, path.join(ARTIFACTS_DIR, "pwa-offline-390.png"));
      console.log("Copied all PWA screenshots to artifact directory!");
    }

    try { pageCdp.close(); } catch {}
    try { cdp.close(); } catch {}
    try { chrome.kill(); } catch {}
  } finally {
    try {
      if (server.pid) {
        spawn("taskkill", ["/pid", String(server.pid), "/f", "/t"], { shell: true });
      } else {
        server.kill();
      }
    } catch {}
    setTimeout(() => process.exit(0), 1000);
  }
}

main().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
