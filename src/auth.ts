import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { verifyPassword, dummyHashWork } from "@/lib/auth/password";
import {
  normalizeEmail,
  checkLoginRateLimit,
  recordFailedLogin,
  clearFailedLogins,
} from "@/lib/auth/rate-limit";

class UnverifiedEmailError extends CredentialsSignin {
  code = "EMAIL_NOT_VERIFIED";
}

class AccountLockedError extends CredentialsSignin {
  code = "ACCOUNT_LOCKED";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
        ip: { label: "IP", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = normalizeEmail(credentials.email as string);
        const password = credentials.password as string;
        const ip = (credentials.ip as string) || "127.0.0.1";

        // 1. Rate limiting and lockout check
        const limitCheck = await checkLoginRateLimit(email, ip);
        if (!limitCheck.allowed) {
          throw new AccountLockedError();
        }

        const supabase = getAdminSupabase();

        // 2. Fetch profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, email, full_name, role, email_verified_at, phone")
          .eq("email", email)
          .single();

        if (!profile) {
          // Constant-time dummy hash so attacker cannot infer email existence
          await dummyHashWork();
          await recordFailedLogin(email, ip);
          return null;
        }

        // 3. Fetch credentials (password_hash, token_version, locked_until)
        const { data: creds } = await supabase
          .from("user_credentials")
          .select("password_hash, token_version, locked_until")
          .eq("user_id", profile.id)
          .single();

        if (!creds || !creds.password_hash) {
          await dummyHashWork();
          await recordFailedLogin(email, ip);
          return null;
        }

        // 4. Verify password
        const isValid = await verifyPassword(password, creds.password_hash);
        if (!isValid) {
          await recordFailedLogin(email, ip);
          return null;
        }

        // 5. Require verified email
        if (!profile.email_verified_at) {
          throw new UnverifiedEmailError();
        }

        // 6. Success: clear failed attempts
        await clearFailedLogins(email, ip);

        return {
          id: profile.id,
          email: profile.email,
          name: profile.full_name,
          role: profile.role,
          emailVerified: profile.email_verified_at,
          tokenVersion: creds.token_version,
        };
      },
    }),
  ],
});
