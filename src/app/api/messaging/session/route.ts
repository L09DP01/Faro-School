import {getCurrentUser} from '@/lib/auth/get-user';
import {pushConfiguration} from '@/lib/push/web-push';
export const dynamic='force-dynamic';
export async function GET(){const user=await getCurrentUser();if(!user)return Response.json({error:'unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});const config=pushConfiguration();return Response.json({userId:user.id,role:user.role,locale:user.locale,push:{configured:!!config,publicKey:config?.publicKey||null}},{headers:{'Cache-Control':'no-store'}});}
