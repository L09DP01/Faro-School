import { KobaraProvider } from "./kobara";

export * from "./types";
export * from "./kobara";

/**
 * Returns the unified Kobara payment provider instance
 */
export function getPaymentProvider(): KobaraProvider {
  return new KobaraProvider();
}
