import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
/** Called only for staff IDs from an already authorized conversation. */
export async function isStaffOnline(staffId:string):Promise<boolean>{
 const {data,error}=await createAdminClient().from('profiles').select('last_seen_at,role,staff_available').eq('id',staffId).single();
 return !error&&!!data&&['admin','instructor'].includes(data.role)&&data.staff_available!==false&&!!data.last_seen_at&&Date.now()-Date.parse(data.last_seen_at)<=90000;
}
export async function recordStaffHeartbeat(staffUserId:string,staffRole:string):Promise<boolean>{
 if(!['admin','instructor'].includes(staffRole))return false;const db=await createClient();const {data,error}=await db.from('profiles').update({last_seen_at:new Date().toISOString()}).eq('id',staffUserId).select('id').single();return !error&&!!data;
}
export async function setStaffAvailability(staffUserId:string,staffRole:string,isAvailable:boolean):Promise<boolean>{
 if(!['admin','instructor'].includes(staffRole)||typeof isAvailable!=='boolean')return false;const db=await createClient();const {data,error}=await db.from('profiles').update({staff_available:isAvailable}).eq('id',staffUserId).select('id').single();return !error&&!!data;
}
