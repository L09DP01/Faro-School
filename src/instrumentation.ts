import { validateEnvironment } from "@/lib/env";
/** Next calls register before serving requests. Never include environment values in errors. */
export function register() { validateEnvironment(); }
