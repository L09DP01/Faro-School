export interface AiWebSource{url:string;title:string;}
export function safeSourceUrl(value:unknown){try{const u=new URL(String(value));if(u.protocol!=='https:'||u.username||u.password||u.hostname==='localhost'||u.hostname.endsWith('.local')||!u.hostname.includes('.')||/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname))return null;return u.href;}catch{return null;}}
export function cleanSearchQuery(question:string){return question.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'').replace(/https?:\/\/\S+/g,'').replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi,'').replace(/\d[\d\s()+.-]{5,}\d/g,'').slice(0,400).trim();}

export function redactIdentity(text:string,name:string){let result=text;for(const part of [name,...name.split(/\s+/)].filter(v=>v.length>=2).sort((a,b)=>b.length-a.length))result=result.replace(new RegExp(part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),'');return cleanSearchQuery(result);}
