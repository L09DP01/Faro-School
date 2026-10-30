import 'server-only';
import {cache} from 'react';
import { getCurrentUser, type CurrentUser } from '@/lib/auth/get-user';
import { createAdminClient } from '@/lib/supabase/admin';
import { can } from '@/lib/permissions';

/** Active granted enrollments also qualify; signup alone never grants membership. */
export const hasCommunityAccess=cache(async(user: CurrentUser | null): Promise<boolean> => {
  if(!user?.emailVerified)return false;
  const db=createAdminClient({timeoutMs:10000});
  const {data:profile,error:profileError}=await db.from('profiles').select('banned_at').eq('id',user.id).maybeSingle();
  if(profileError||!profile||profile.banned_at)return false;
  if(user.role==='admin'||user.role==='instructor')return can(user,'community.access');
  const {data,error}=await db.from('enrollments').select('id').eq('user_id',user.id).is('revoked_at',null).limit(1).maybeSingle();
  return !error&&can(user,'community.access',{hasActiveEnrollment:!!data});
});
export async function requireCommunityAccess(): Promise<void> {
  if(!await hasCommunityAccess(await getCurrentUser()))throw new Error('community_access_required');
}
