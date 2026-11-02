import {createClient} from '@/lib/supabase/server';
import type {CourseReviewItem} from '@/components/course/CourseReviews';
export interface PublicAuthor {fullName:string;avatarUrl:string|null;title:string;bio:string}
export interface PublicCourseFacts {courseId:string;studentsCount:number;reviewsCount:number;averageRating:number|null;reviews:CourseReviewItem[];instructor:PublicAuthor|null}
export async function getPublicCourseFacts(ids:string[]):Promise<Map<string,PublicCourseFacts>>{
 if(!ids.length)return new Map();
 const db=await createClient();const {data,error}=await db.rpc('course_public_facts',{p_ids:ids});
 if(error||!Array.isArray(data))return new Map(); // unavailable stays unknown, never fabricated zero
 return new Map(data.map((row:PublicCourseFacts)=>[row.courseId,row]));
}
