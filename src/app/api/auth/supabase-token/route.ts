import {getCurrentUser} from '@/lib/auth/get-user';
import {signSupabaseToken} from '@/lib/auth/supabase-jwt';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){
 const user=await getCurrentUser();
 if(!user||!user.email)return Response.json({error:'unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
 const token=await signSupabaseToken({id:user.id,role:user.role,email:user.email,tokenVersion:user.tokenVersion});
 return Response.json({token,expiresIn:3600},{headers:{'Cache-Control':'no-store, max-age=0'}});
}
