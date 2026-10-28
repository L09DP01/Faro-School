import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const PORT = 3008;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACTS_DIR = "C:\\Users\\owner\\.gemini\\antigravity\\brain\\ccec8969-18ac-4abc-8efb-e923a1172981";

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
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
  console.log("1. Starting Next.js server on port " + PORT + "...");
  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    shell: true,
    env: { ...process.env, PORT: String(PORT) },
  });

  server.stdout.on("data", (d) => console.log(`[Next] ${d.toString().trim()}`));
  server.stderr.on("data", (d) => console.error(`[Next ERR] ${d.toString().trim()}`));

  try {
    const ready = await waitForServer(`${BASE_URL}/fr`);
    if (!ready) throw new Error("Next server failed to start.");
    console.log("Next server is ready!");

    console.log("2. Launching Chrome headless with remote debugging...");
    const chrome = spawn(CHROME_PATH, [
      "--headless=new",
      "--remote-debugging-port=9222",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${path.resolve("./.chrome-user-data")}`,
    ]);

    await sleep(2000);

    // Get devtools websocket target
    const versionRes = await fetch("http://127.0.0.1:9222/json/version");
    const versionData = await versionRes.json();
    const wsUrl = versionData.webSocketDebuggerUrl;
    console.log("Connected to Chrome via CDP:", wsUrl);

    const cdp = new CdpClient(wsUrl);
    await cdp.connect();

    // Create target page
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const targetWsUrl = `ws://127.0.0.1:9222/devtools/page/${targetId}`;
    const pageCdp = new CdpClient(targetWsUrl);
    await pageCdp.connect();

    await pageCdp.send("Page.enable");
    await pageCdp.send("Network.enable");

    // Set faro_session cookie for student "Jean Baptiste"
    const sessionObj = {
      id: "student-1",
      fullName: "Jean Baptiste",
      role: "student",
      email: "jean.baptiste@faroschool.com",
      locale: "fr",
    };
    const sessionCookieVal = Buffer.from(JSON.stringify(sessionObj)).toString("base64");

    await pageCdp.send("Network.setCookie", {
      name: "faro_session",
      value: sessionCookieVal,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: false,
      secure: false,
    });
    console.log("faro_session cookie injected.");

    // Output directory
    const outDir = path.resolve("./public/brand");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    // 1440px Desktop Screenshot
    console.log("3. Capturing 1440px desktop view...");
    await pageCdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await pageCdp.send("Page.navigate", { url: `${BASE_URL}/fr/dashboard/communaute` });
    await sleep(3500);

    // Ensure any modal overlay is dismissed if opened
    await pageCdp.send("Runtime.evaluate", {
      expression: `
        (function() {
          const checkbox = document.querySelector('input[type="checkbox"]');
          if (checkbox && !checkbox.checked) {
            checkbox.click();
          }
          const buttons = Array.from(document.querySelectorAll('button'));
          const btn = buttons.find(b => b.textContent && b.textContent.includes('Accéder à la communauté'));
          if (btn) btn.click();
        })();
      `,
    });
    await sleep(500);

    const screenshot1440 = await pageCdp.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });

    const file1440 = path.join(outDir, "community-1440.png");
    fs.writeFileSync(file1440, Buffer.from(screenshot1440.data, "base64"));
    console.log("Saved 1440px screenshot:", file1440);

    // 390px Mobile Screenshot
    console.log("4. Capturing 390px mobile view...");
    await pageCdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });

    await pageCdp.send("Page.navigate", { url: `${BASE_URL}/fr/dashboard/communaute` });
    await sleep(3000);

    // Ensure modal is dismissed on mobile as well
    await pageCdp.send("Runtime.evaluate", {
      expression: `
        (function() {
          const checkbox = document.querySelector('input[type="checkbox"]');
          if (checkbox && !checkbox.checked) {
            checkbox.click();
          }
          const buttons = Array.from(document.querySelectorAll('button'));
          const btn = buttons.find(b => b.textContent && b.textContent.includes('Accéder à la communauté'));
          if (btn) btn.click();
        })();
      `,
    });
    await sleep(500);

    const screenshot390 = await pageCdp.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });

    const file390 = path.join(outDir, "community-390.png");
    fs.writeFileSync(file390, Buffer.from(screenshot390.data, "base64"));
    console.log("Saved 390px screenshot:", file390);

    // Copy to artifact directory for presentation
    if (fs.existsSync(ARTIFACTS_DIR)) {
      fs.copyFileSync(file1440, path.join(ARTIFACTS_DIR, "community-1440.png"));
      fs.copyFileSync(file390, path.join(ARTIFACTS_DIR, "community-390.png"));
      console.log("Copied screenshots to artifact directory:", ARTIFACTS_DIR);
    }

    try { pageCdp.close(); } catch {}
    try { cdp.close(); } catch {}
    try { chrome.kill(); } catch {}
    console.log("Finished capturing screenshots successfully!");
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
  console.error("Capture failed:", err);
  process.exit(1);
});
