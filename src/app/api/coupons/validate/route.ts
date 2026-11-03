import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {createClient} from '@/lib/supabase/server';
import {getCurrentUser} from '@/lib/auth/get-user';
import {evaluateCoupon} from '@/lib/payments/coupon';
import {checkRateLimit} from '@/lib/security/rate-limit';
export const runtime='nodejs';
const schema=z.object({code:z.string().trim().toUpperCase().min(3).max(30).regex(/^[A-Z0-9_-]+$/),courseId:z.string().uuid()});
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:NextRequest){try{
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return reply({valid:false,error:'forbidden'},403);
 if(!await getCurrentUser())return reply({valid:false,error:'unauthorized'},401);
 const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'127.0.0.1';
 if(!(await checkRateLimit('coupon:'+ip,10,5*60*1000)).allowed)return reply({valid:false,error:'rateLimit'},429);
 const parsed=schema.safeParse(await req.json());if(!parsed.success)return reply({valid:false,error:'invalidCoupon'},400);
 const db=await createClient();const{data:course,error:courseError}=await db.from('courses').select('price_htg,status').eq('id',parsed.data.courseId).maybeSingle();
 if(courseError)return reply({valid:false,error:'unavailable'},503);
 if(!course||course.status!=='published'||!Number.isSafeInteger(course.price_htg)||course.price_htg<0)return reply({valid:false,error:'courseUnavailable'},404);
 const{data:coupon,error}=await db.from('coupons').select('id,code,percent_off,amount_off_htg,max_uses,used_count,expires_at,is_active').eq('code',parsed.data.code).maybeSingle();
 if(error)return reply({valid:false,error:'unavailable'},503);if(!coupon)return reply({valid:false,error:'invalidCoupon'},404);
 const result=evaluateCoupon(coupon,course.price_htg);if(!result.valid)return reply({valid:false,error:result.error},400);
 return reply({valid:true,code:coupon.code,couponId:coupon.id,discountHtg:result.discountHtg,newTotalHtg:result.newTotalHtg,percentOff:coupon.percent_off,amountOffHtg:coupon.amount_off_htg});
 }catch{return reply({valid:false,error:'unavailable'},503);}}
