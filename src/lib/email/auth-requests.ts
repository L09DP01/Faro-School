import 'server-only';
import { z } from 'zod';
import { getAdminSupabase } from '@/lib/supabase/admin';
import { checkEmailDispatchLimit, normalizeEmail } from '@/lib/auth/rate-limit';
import { hashPassword } from '@/lib/auth/password';
import { type SignupInput, sanitizeRedirectUrl, validateAndFormatHaitianPhone } from '@/lib/validators/auth';
import { queueAuthEmail } from '@/lib/email/outbox';
import { logEmailFailure } from './diagnostics';

interface Context { ip: string; locale: 'fr' | 'ht'; next?: string }
const createdUserSchema = z.object({ user_id: z.string().uuid() });

async function dispatch(email: string, kind: 'verification' | 'reset' | 'registration_alert', context: Context) {
  const result = await queueAuthEmail(email, kind, context.locale, undefined, context.next);
  if (result.status !== 'accepted') logEmailFailure('dispatch_' + kind, undefined, result.correlationId);
}

/** A request reserves exactly one atomic budget, before any account-specific branch. */
export async function registerAccount(input: SignupInput, context: Context): Promise<void> {
  const email = normalizeEmail(input.email);
  const budget = await checkEmailDispatchLimit(email, context.ip, 'verification_email');
  if (!budget.allowed) return;

  const db = getAdminSupabase({ timeoutMs: 10000 });
  const { data: existing, error: lookupError } = await db.from('profiles')
    .select('id,email_verified_at').eq('email', email).maybeSingle();
  if (lookupError) { logEmailFailure('registration_profile_lookup', lookupError); return; }

  if (!existing) {
    // The existing SQL contract requires p_id and returns JSON { user_id, ... }.
    // Never fall back to partial profile/credential inserts when the RPC fails.
    const { data, error } = await db.rpc('create_user_with_credentials', {
      p_id: crypto.randomUUID(), p_email: email, p_full_name: input.fullName,
      p_phone: validateAndFormatHaitianPhone(input.phone).formatted,
      p_role: 'student', p_locale: context.locale,
      p_password_hash: await hashPassword(input.password), p_email_verified_at: null,
    });
    if (error || !createdUserSchema.safeParse(data).success) {
      // Concurrent registration may have won the unique-email race. Never modify
      // an existing password, name, role or verification state on registration.
      if (error?.code !== '23505') { logEmailFailure('registration_create_account', error); return; }
      const { data: winner, error: raceError } = await db.from('profiles')
        .select('id,email_verified_at').eq('email', email).maybeSingle();
      if (raceError || !winner) { logEmailFailure('registration_concurrent_lookup', raceError); return; }
      await dispatch(email, winner.email_verified_at ? 'registration_alert' : 'verification', context);
      return;
    }
  }

  await dispatch(email, existing?.email_verified_at ? 'registration_alert' : 'verification', {
    ...context, next: sanitizeRedirectUrl(context.next, '/' + context.locale + '/dashboard'),
  });
}

/** Resend and recovery share the same limiter and dispatch path as registration. */
export async function requestAccountEmail(emailInput: string, kind: 'verification' | 'reset', context: Context): Promise<void> {
  const email = normalizeEmail(emailInput);
  const budget = await checkEmailDispatchLimit(email, context.ip, kind === 'reset' ? 'reset_email' : 'verification_email');
  if (!budget.allowed) return;
  const { data: profile, error } = await getAdminSupabase({ timeoutMs: 10000 }).from('profiles')
    .select('id,email_verified_at').eq('email', email).maybeSingle();
  if (error) { logEmailFailure('request_profile_lookup', error); return; }
  if (!profile || (kind === 'verification' && profile.email_verified_at)) return;
  await dispatch(email, kind, context);
}
