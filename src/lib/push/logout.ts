import 'server-only';
import {auth} from '@/auth';
import {createAdminClient} from '@/lib/supabase/admin';
export async function removeDevicePushSubscription(id:string){
 const session=await auth();if(!session?.user?.id)return;
 const{error}=await createAdminClient().from('message_push_subscriptions').delete().eq('id',id).eq('user_id',session.user.id);
 if(error)console.error('[push] unsubscribe_unavailable');
}
