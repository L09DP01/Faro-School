import {createClient} from '@/lib/supabase/server';

/** Called only after the page has verified its own user session. */
export async function chatRestriction(userId:string){
 const db=await createClient();const {data,error}=await db.from('profiles').select('muted_until').eq('id',userId).single();
 return {blocked:!!error||!data||!!(data.muted_until&&Date.parse(data.muted_until)>Date.now()),until:data?.muted_until as string|undefined};
}
export function ChatRestrictionNotice({locale,until}:{locale:string;until?:string}){
 const ht=locale==='ht';const date=until?new Intl.DateTimeFormat(ht?'ht-HT':'fr-FR',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Port-au-Prince'}).format(new Date(until)):null;
 return <section role="status" className="m-auto max-w-md rounded-2xl border border-line bg-surface p-6 space-y-3"><h1 className="font-heading text-xl font-bold text-ink">{ht?'Chat la pa disponib':'Chat indisponible'}</h1><p className="text-sm text-muted-faro">{date?(ht?'Aksè ou nan chat la sispann jiska '+date+'. Kou ou yo ak lòt sèvis yo toujou disponib.':'Votre accès au chat est suspendu jusqu’au '+date+'. Vos cours et les autres services restent disponibles.'):(ht?'Nou pa ka verifye aksè chat la. Eseye ankò pita.':'Impossible de vérifier l’accès au chat. Réessayez dans quelques instants.')}</p></section>;
}
