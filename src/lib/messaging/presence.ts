import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
/** Lease for at least one verified session; never use last login as presence. */
export async function isStaffOnline(staffId:string):Promise<boolean>{
 const {data,error}=await createAdminClient().rpc('staff_is_online',{p_staff:staffId});return !error&&data===true;
}
export async function recordStaffHeartbeat(_id:string,_role:string):Promise<boolean>{return false;}
export async function setStaffAvailability(staffUserId:string,staffRole:string,isAvailable:boolean):Promise<boolean>{
 if(!['admin','instructor'].includes(staffRole)||typeof isAvailable!=='boolean')return false;const db=await createClient();const {data,error}=await db.from('profiles').update({staff_available:isAvailable}).eq('id',staffUserId).select('id').single();return !error&&!!data;
}
