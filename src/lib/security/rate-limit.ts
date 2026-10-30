import {reserveBudget} from '@/lib/auth/rate-limit';
export async function checkRateLimit(key:string,maxRequests=5,windowMs=3600000){const result=await reserveBudget(key,key,'form',maxRequests,Math.ceil(windowMs/1000),0);return{allowed:result.allowed,remaining:0};}
