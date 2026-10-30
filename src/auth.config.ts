import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible Auth.js configuration for Middleware and Edge runtimes.
 * Contains ZERO database calls, zero Node-only crypto, and zero native bcrypt.
 */
export const authConfig: NextAuthConfig = {
  // Shared with middleware's getToken: the cookie name is also the JWE salt.
  useSecureCookies: process.env.NODE_ENV === "production",
  providers: [], // Added in auth.ts
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/connexion",
    newUser: "/inscription",
    error: "/connexion",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || "student";
        token.emailVerified = (user as any).emailVerified || null;
        token.tokenVersion = (user as any).tokenVersion ?? 0;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role as string;
        (session.user as any).emailVerified = token.emailVerified as string | null;
        (session.user as any).tokenVersion = (token.tokenVersion as number) ?? 0;
      }
      return session;
    },
  },
};
