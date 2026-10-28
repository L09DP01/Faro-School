import type { VideoProvider } from "./types";
import { BunnyStreamProvider } from "./bunny-stream";
import { MockVideoProvider } from "./mock-provider";

export * from "./types";
export * from "./access";
export * from "./bunny-stream";
export * from "./bunny-storage";
export * from "./mock-provider";
export * from "./session";

/**
 * Factory helper: Returns BunnyStreamProvider if API keys are set, otherwise MockVideoProvider.
 */
export function getVideoProvider(): VideoProvider {
  const hasBunnyConfig =
    Boolean(process.env.BUNNY_STREAM_API_KEY) &&
    Boolean(process.env.BUNNY_STREAM_LIBRARY_ID) &&
    Boolean(process.env.BUNNY_STREAM_TOKEN_AUTH_KEY);

  if (hasBunnyConfig) {
    return new BunnyStreamProvider();
  }

  return new MockVideoProvider();
}
