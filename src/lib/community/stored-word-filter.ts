import "server-only";
import {createClient} from '@/lib/supabase/server';
import {checkProfanity} from './word-filter';
/** Read persisted settings per request, never rely on a Worker instance's memory. */
export async function checkStoredProfanity(text:string){
 const db=await createClient();const {data,error}=await db.from('platform_settings').select('value').eq('key','word_filter').maybeSingle();
 if(error)throw new Error('moderation_unavailable');
 const value=data?.value as {fr?:string[];ht?:string[]}|undefined;
 return checkProfanity(text,[...(value?.fr||[]),...(value?.ht||[])]);
}
