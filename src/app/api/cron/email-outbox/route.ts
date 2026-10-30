import {processOutbox} from '@/lib/email/outbox';
import {sha256} from '@/lib/webhooks/security';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET?.trim(),auth=request.headers.get('authorization')??'';
 if(!secret)return Response.json({error:'unavailable'},{status:503});
 if(await sha256(auth)!==await sha256('Bearer '+secret))return Response.json({error:'unauthorized'},{status:401});
 try{const results=await processOutbox();return Response.json({processed:results.length},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'unavailable'},{status:503});}
}
