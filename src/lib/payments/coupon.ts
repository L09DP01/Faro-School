export interface CheckoutCoupon{id:string;code:string;percent_off:number|null;amount_off_htg:number|null;max_uses:number|null;used_count:number;expires_at:string|null;is_active:boolean}
/** Shared preview/checkout calculation, using database prices only. */
export function evaluateCoupon(coupon:CheckoutCoupon,price:number,now=Date.now()){
 const bad=(error:string)=>({valid:false,error,discountHtg:0,newTotalHtg:price});
 if(!Number.isSafeInteger(price)||price<0)return bad('courseUnavailable');
 if(coupon.is_active!==true)return bad('inactiveCoupon');
 if(coupon.expires_at&&(!Number.isFinite(Date.parse(coupon.expires_at))||Date.parse(coupon.expires_at)<=now))return bad('expiredCoupon');
 if(!Number.isInteger(coupon.used_count)||coupon.used_count<0||coupon.max_uses!==null&&(!Number.isInteger(coupon.max_uses)||coupon.max_uses<1||coupon.used_count>=coupon.max_uses))return bad('maxUsesReached');
 const percent=coupon.percent_off,amount=coupon.amount_off_htg;
 if((percent===null)===(amount===null))return bad('invalidCoupon');
 if(percent!==null&&(!Number.isInteger(percent)||percent<1||percent>100)||amount!==null&&(!Number.isSafeInteger(amount)||amount<1))return bad('invalidCoupon');
 const discountHtg=percent!==null?Math.round(price*percent/100):Math.min(price,amount!);
 return{valid:true,error:null,discountHtg,newTotalHtg:Math.max(0,price-discountHtg)};
}
