"use server";

import {cookies} from 'next/headers';
import {signOut} from '@/auth';

/** Complete logout before allowing the client to navigate to the login page. */
export async function logoutAccountAction(locale: string = 'fr') {
  const existing=await cookies(),pushId=existing.get?.('faro_push_subscription')?.value;
  if(pushId&&/^[a-f0-9-]{36}$/i.test(pushId)){try{const{removeDevicePushSubscription}=await import('../../lib/push/logout');await removeDevicePushSubscription(pushId);}catch{console.error('[push] unsubscribe_unavailable');}}
  await signOut({redirect: false});
  const store = await cookies();
  if(pushId)store.delete('faro_push_subscription');
  // Also expire legacy/chunked cookies that may coexist after an auth migration.
  const names = new Set([
    'authjs.session-token', '__Secure-authjs.session-token',
    'next-auth.session-token', '__Secure-next-auth.session-token',
    ...store.getAll().map(cookie => cookie.name).filter(name =>
      /^(?:__Secure-|__Host-)?(?:authjs|next-auth)\.(?:session-token(?:\.\d+)?|callback-url)$/.test(name)),
  ]);
  for (const name of names) store.set(name, '', {
    path: '/', httpOnly: true, sameSite: 'lax',
    secure: name.startsWith('__Secure-') || name.startsWith('__Host-') || process.env.NODE_ENV === 'production',
    maxAge: 0, expires: new Date(0),
  });
  return {redirectTo: `/${locale === 'ht' ? 'ht' : 'fr'}/connexion`};
}
