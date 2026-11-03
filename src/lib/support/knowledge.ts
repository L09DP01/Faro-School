import 'server-only';
import seedVersions from './seed-provenance.json';
import{sourceVersion}from'./provenance';
import{createAdminClient}from'@/lib/supabase/admin';import{type HelpArticle}from'./types';
/** Explicit publication filter even with the trusted server client. No internal documents. */
export async function searchHelpArticles(query:string,category?:string):Promise<HelpArticle[]>{
 const db=createAdminClient();const {data,error}=await db.rpc('search_support_articles',{p_query:query.slice(0,300),p_category:category||null});if(error)throw Error('knowledge_unavailable');if(!Array.isArray(data))return[];const checked=await Promise.all(data.slice(0,5).map(async a=>{const current=await sourceVersion(a.source_refs||[]);const seed=(seedVersions as Record<string,{legacy:string;canonical:string}>)[a.slug];return !a.source_version||a.source_version===current||(seed&&a.source_version===seed.legacy&&current===seed.canonical)?a:null;}));return checked.filter((a):a is HelpArticle=>a!==null);
}
export function articleContext(articles:HelpArticle[]){return articles.map(a=>({id:a.id,title:a.title,description:a.description,procedure:a.content.procedure,conditions:a.content.conditions,knownErrors:a.content.known_errors,solutions:a.content.solutions,links:a.content.links,revision:a.revision,updatedAt:a.updated_at}));}
