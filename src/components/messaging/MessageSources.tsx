import {safeSourceUrl} from '@/lib/messaging/web-sources';
import type {PrivateMessage} from '@/lib/messaging/types';
export function MessageSources({meta,locale}:{meta?:PrivateMessage['meta'];locale:string}){
 const sources=Array.isArray(meta?.sources)?meta.sources.filter((s:any)=>s&&typeof s.url==='string'&&safeSourceUrl(s.url)).slice(0,6):[];
 if(!sources.length)return null;
 return <div className="mt-3 border-t border-line pt-2 space-y-2 text-xs whitespace-normal"><p className="font-semibold text-navy">{locale==='ht'?'Sous konsilte':'Sources consultées'}</p><ul className="space-y-1">{sources.map((s:any)=><li key={s.url}><a href={safeSourceUrl(s.url)!} target="_blank" rel="noopener noreferrer" className="underline text-blue break-words">{typeof s.title==='string'?s.title.slice(0,160):new URL(s.url).hostname}</a></li>)}</ul>{typeof meta?.searchWidget==='string'?<iframe title={locale==='ht'?'Sijesyon rechèch Google':'Suggestions de recherche Google'} srcDoc={meta.searchWidget.slice(0,24000)} sandbox="allow-popups allow-popups-to-escape-sandbox" className="w-full h-28 border-0" referrerPolicy="no-referrer"/>:null}</div>;
}
