"use server";
import {createAdminClient} from '@/lib/supabase/admin';
import {getCurrentUser} from '@/lib/auth/get-user';
import {can} from '@/lib/permissions';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {couponFormSchema,type CouponFormData} from '@/lib/admin/promotion-types';
async function mutate(operation:string,value:Record<string,unknown>){
 try{const user=await getCurrentUser();if(!user||user.role!=='admin'||!can(user,'promotions.manage'))return{success:false as const,error:'forbidden'};
 const{data,error}=await createAdminClient().rpc('manage_promotion_coupon',{p_actor:user.id,p_version:user.tokenVersion??0,p_operation:operation,p_value:value});
 if(error||!data?.id)return{success:false as const,error:error?.code==='23505'?'duplicate_code':error?.message?.includes('not_found')?'not_found':'unavailable'};
 revalidatePath('/[locale]/admin/promotions','page');return{success:true as const,id:data.id as string,archived:data.archived===true};
 }catch{return{success:false as const,error:'unavailable'};}
}
export async function saveCouponAction(raw:CouponFormData){
 const parsed=couponFormSchema.safeParse(raw);if(!parsed.success)return{success:false as const,error:'invalid_data'};const d=parsed.data;
 if(d.id&&!z.string().uuid().safeParse(d.id).success)return{success:false as const,error:'invalid_id'};
 if(d.expiresAt&&!Number.isFinite(Date.parse(d.expiresAt)))return{success:false as const,error:'invalid_date'};
 return mutate('save',{id:d.id,code:d.code,percent_off:d.discountType==='percent'?d.discountValue:null,amount_off_htg:d.discountType==='amount'?d.discountValue:null,max_uses:d.maxUses??null,expires_at:d.expiresAt||null,is_active:d.isActive});
}
export async function toggleCouponActiveAction(id:string,isActive:boolean){if(!z.string().uuid().safeParse(id).success||typeof isActive!=='boolean')return{success:false as const,error:'invalid_data'};return mutate('toggle',{id,is_active:isActive});}
export async function deleteCouponAction(id:string){if(!z.string().uuid().safeParse(id).success)return{success:false as const,error:'invalid_id'};return mutate('delete',{id});}
