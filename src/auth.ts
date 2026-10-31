import {jwtVerify} from "jose";
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

async function staffAccountEnabled(db:ReturnType<typeof getAdminSupabase>,id:string,role:string){
 if(role!=='instructor')return true;const {data,error}=await db.from('instructors').select('is_active').eq('profile_id',id).maybeSingle();return !error&&!!data&&data.is_active!==false;
}
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        verificationGrant: {type:"text"},
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
        ip: { label: "IP", type: "text" },
      },
      async authorize(credentials, request) {
        if (typeof credentials?.verificationGrant === 'string') {
          try {
            const {payload}=await jwtVerify(credentials.verificationGrant,new TextEncoder().encode(process.env.AUTH_SECRET),{audience:'email-verification-login',issuer:'faro',algorithms:['HS256']});
            const db=getAdminSupabase();
            const {data:p,error}=await db.from('profiles').select('id,email,full_name,role,email_verified_at,banned_at').eq('id',payload.sub!).single();
            const {data:c,error:ce}=await db.from('user_credentials').select('token_version').eq('user_id',payload.sub!).single();
            if(error||ce||!p?.email_verified_at||p.banned_at||!c||!await staffAccountEnabled(db,p.id,p.role))return null;
            return{id:p.id,email:p.email,name:p.full_name,role:p.role,emailVerified:p.email_verified_at,tokenVersion:c.token_version};
          }catch{return null;}
        }
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = normalizeEmail(credentials.email as string);
        const password = credentials.password as string;
        const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

        // 1. Rate limiting and lockout check
        const limitCheck = await checkLoginRateLimit(email, ip);
        if (!limitCheck.allowed) {
          throw new AccountLockedError();
        }

        const supabase = getAdminSupabase();

        // 2. Fetch profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, email, full_name, role, email_verified_at, phone, banned_at")
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

        if(profile.banned_at||!await staffAccountEnabled(supabase,profile.id,profile.role))return null;

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
