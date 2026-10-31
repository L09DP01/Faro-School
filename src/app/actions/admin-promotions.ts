"use server";
import {createClient} from '@/lib/supabase/server';
import {getCurrentUser} from '@/lib/auth/get-user';
import {can} from '@/lib/permissions';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {couponFormSchema,type CouponFormData} from '@/lib/admin/promotion-types';
import {logAdminAction} from '@/lib/admin/moderation';
async function assertAdmin(){const user=await getCurrentUser();if(!user || user.role !== "admin" || !can(user,"promotions.manage"))throw Error('forbidden');return user;}
export async function saveCouponAction(raw:CouponFormData){try{
 const user=await assertAdmin(),parsed=couponFormSchema.safeParse(raw);if(!parsed.success)return{success:false,error:user.locale==='ht'?'Done yo pa valab.':'Données invalides.'};
 const d=parsed.data;if(d.id&&!z.string().uuid().safeParse(d.id).success)return{success:false,error:'invalid_id'};
 if(d.expiresAt&&!Number.isFinite(Date.parse(d.expiresAt)))return{success:false,error:'invalid_date'};
 const db=await createClient(),value={code:d.code.trim().toUpperCase(),percent_off:d.discountType==='percent'?d.discountValue:null,amount_off_htg:d.discountType==='amount'?d.discountValue:null,max_uses:d.maxUses??null,expires_at:d.expiresAt||null,is_active:d.isActive};
 const result=d.id?await db.from('coupons').update(value).eq('id',d.id).select('id').single():await db.from('coupons').insert(value).select('id').single();
 if(result.error||!result.data)return{success:false,error:result.error?.code==='23505'?'duplicate_code':'unavailable'};
 await logAdminAction(user.id,d.id?'update_coupon':'create_coupon',result.data.id);revalidatePath('/[locale]/admin/promotions','page');return{success:true,id:result.data.id};
 }catch{return{success:false,error:'unavailable'};}}
export async function toggleCouponActiveAction(id:string,isActive:boolean){try{const user=await assertAdmin();if(!z.string().uuid().safeParse(id).success||typeof isActive!=='boolean')return{success:false,error:'invalid_data'};const db=await createClient(),{data,error}=await db.from('coupons').update({is_active:isActive}).eq('id',id).select('id').single();if(error||!data)throw Error();await logAdminAction(user.id,isActive?'activate_coupon':'deactivate_coupon',id);revalidatePath('/[locale]/admin/promotions','page');return{success:true};}catch{return{success:false,error:'unavailable'};}}
export async function deleteCouponAction(id:string){try{const user=await assertAdmin();if(!z.string().uuid().safeParse(id).success)return{success:false,error:'invalid_id'};const db=await createClient();const {count,error:lookupError}=await db.from('orders').select('id',{count:'exact',head:true}).eq('coupon_id',id);if(lookupError)throw Error();const archived=(count||0)>0;const result=archived?await db.from('coupons').update({is_active:false}).eq('id',id).select('id').single():await db.from('coupons').delete().eq('id',id).select('id').single();if(result.error||!result.data)throw Error();await logAdminAction(user.id,archived?'archive_coupon':'delete_coupon',id);revalidatePath('/[locale]/admin/promotions','page');return{success:true,archived};}catch{return{success:false,error:'unavailable'};}}
