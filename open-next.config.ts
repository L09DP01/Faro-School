import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig({});

// The public build script creates the Worker. Invoke only Next.js inside OpenNext
// so `pnpm run build` cannot recursively call itself.
config.buildCommand = "pnpm run build:next";

export default config;
