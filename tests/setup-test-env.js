const Module = require("node:module");
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === "server-only") {
    return {};
  }
  return originalRequire.apply(this, arguments);
};

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-service-role-key-test-offline";
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-supabase.supabase.co";
}

// Fast offline fallback for Supabase fetch in tests when live DB is not configured
const originalFetch = globalThis.fetch;
if (originalFetch) {
  globalThis.fetch = async function (input, init) {
    let url = "";
    if (typeof input === "string") {
      url = input;
    } else if (input && typeof input.url === "string") {
      url = input.url;
    } else if (input && typeof input.href === "string") {
      url = input.href;
    } else if (input && typeof input.toString === "function") {
      url = input.toString();
    }

    if (
      !process.env.TEST_SUPABASE_URL &&
      (url.includes("mock-supabase") ||
        url.includes("example.co") ||
        url.includes(".supabase.co"))
    ) {
      return new Response(JSON.stringify({ error: "Offline test mock" }), {
        status: 503,
        statusText: "Offline test environment",
        headers: { "Content-Type": "application/json" },
      });
    }
    return originalFetch.apply(this, arguments);
  };
}
