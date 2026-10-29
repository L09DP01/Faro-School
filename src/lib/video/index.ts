import type { VideoProvider } from "./types";
import { BunnyStreamProvider } from "./bunny-stream";

export * from "./types";
export * from "./access";
export * from "./bunny-stream";
export * from "./bunny-storage";
export * from "./session";

/**
 * Factory helper: Returns BunnyStreamProvider if API keys are set, otherwise throws failing closed.
 */
export function getVideoProvider(): VideoProvider {
  const hasBunnyConfig =
    Boolean(process.env.BUNNY_STREAM_API_KEY) &&
    Boolean(process.env.BUNNY_STREAM_LIBRARY_ID) &&
    Boolean(process.env.BUNNY_STREAM_TOKEN_AUTH_KEY);

  if (hasBunnyConfig) {
    return new BunnyStreamProvider();
  }

  throw new Error("Bunny Stream configuration is missing. Video playback cannot proceed.");
}
