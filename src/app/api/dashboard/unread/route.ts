import {getCurrentUser} from '@/lib/auth/get-user';
import {hasCommunityAccess} from '@/lib/community/access';
import {getUnreadCommunityCount} from '@/lib/community/data';
import {getUnreadPrivateMessagesCount} from '@/lib/messaging/data';
import {createClient} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export async function GET(){
 const user=await getCurrentUser();
 if(!user)return Response.json({error:'unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
 try{
  const allowed=await hasCommunityAccess(user),db=await createClient();
  const [community,messages,notifications]=await Promise.all([
   allowed?getUnreadCommunityCount(user.id):Promise.resolve(0),
   getUnreadPrivateMessagesCount(user.id),
   db.from('notifications').select('id',{head:true,count:'exact'}).eq('user_id',user.id).is('read_at',null),
  ]);
  return Response.json({community,messages,notifications:notifications.error?0:notifications.count??0},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({community:0,messages:0,notifications:0},{headers:{'Cache-Control':'no-store'}});}
}
