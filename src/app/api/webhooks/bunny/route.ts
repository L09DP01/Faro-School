import {z} from "zod";
import {createAdminClient} from "@/lib/supabase/admin";
import {readWebhookBody,parseWebhook,verifyBunny,sha256,WebhookError,webhookResponse,webhookFailure} from "@/lib/webhooks/security";
// OpenNext runs the Next.js nodejs runtime inside Cloudflare Workers.
export const runtime="nodejs";
export const dynamic="force-dynamic";
const eventSchema=z.object({VideoLibraryId:z.number().int().positive().safe(),VideoGuid:z.string().uuid(),Status:z.number().int().nonnegative(),EventId:z.string().uuid(),Timestamp:z.string().datetime({offset:true}),IsLiveStreamWebhook:z.boolean().optional()});
const videoSchema=z.object({guid:z.string().uuid(),videoLibraryId:z.number().int(),length:z.number().int().min(0).max(2147483647)});
const lifecycle=new Set([0,1,2,3,4,5,6,7,8,32]);
export async function POST(request:Request){try{
 const secret=process.env.BUNNY_STREAM_READ_ONLY_API_KEY,library=process.env.BUNNY_STREAM_LIBRARY_ID;
 if(!secret||!library||!/^\d+$/.test(library))throw new WebhookError(503,"webhook_not_configured");
 const raw=await readWebhookBody(request);
 if(!await verifyBunny(raw,request.headers,secret))throw new WebhookError(401,"invalid_signature");
 const parsed=eventSchema.safeParse(parseWebhook(raw));if(!parsed.success)throw new WebhookError(400,"invalid_event");
 const e=parsed.data;
 if(String(e.VideoLibraryId)!==library)throw new WebhookError(403,"library_mismatch");
 if(Date.parse(e.Timestamp)>Date.now()+300000)throw new WebhookError(400,"invalid_event_time");
 if(e.IsLiveStreamWebhook||!lifecycle.has(e.Status))return webhookResponse({received:true,ignored:true});
 const db=createAdminClient(),hash=await sha256(raw);
 const {data:receipt,error:lookupError}=await db.from("webhook_events").select("body_hash").eq("provider","bunny").eq("event_id",e.EventId).maybeSingle();
 if(lookupError)throw new Error("receipt_lookup_failed");
 if(receipt){if(receipt.body_hash!==hash)throw new WebhookError(409,"event_conflict");return webhookResponse({received:true,duplicate:true});}
 let duration:number|null=null;
 if(e.Status===3||e.Status===4){
  // The callback does not carry duration. Read it from Bunny, never from the browser.
  const response=await fetch(`https://video.bunnycdn.com/library/${library}/videos/${e.VideoGuid}`,{headers:{AccessKey:secret,Accept:"application/json"},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error("bunny_metadata_unavailable");
  const video=videoSchema.safeParse(await response.json());
  if(!video.success||video.data.guid.toLowerCase()!==e.VideoGuid.toLowerCase()||video.data.videoLibraryId!==e.VideoLibraryId)throw new Error("bunny_metadata_invalid");
  duration=video.data.length;
 }
 const {data,error}=await db.rpc("apply_bunny_webhook",{p_event_id:e.EventId,p_library_id:e.VideoLibraryId,p_video_id:e.VideoGuid,p_status:e.Status,p_duration:duration,p_occurred_at:e.Timestamp,p_hash:hash});
 if(error)throw new Error("webhook_transaction_failed");
 return webhookResponse({received:true,duplicate:data?.duplicate===true});
}catch(error){return webhookFailure(error);}}
