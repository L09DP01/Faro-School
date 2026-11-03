/** Accept only the actual or configured public application origin. */
export function isSameOriginRequest(request:Request){
 if(request.headers.get('sec-fetch-site')==='cross-site')return false;
 const origin=request.headers.get('origin');if(!origin)return false;
 const allowed=new Set([new URL(request.url).origin]);
 for(const value of [process.env.NEXT_PUBLIC_APP_URL,process.env.AUTH_URL]){try{if(value)allowed.add(new URL(value).origin);}catch{}}
 return allowed.has(origin);
}
