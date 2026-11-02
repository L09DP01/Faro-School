import type {DirectUploadResult} from './types';
const ENDPOINT='https://video.bunnycdn.com/tusupload';
export function validateVideoFile(file:File){
 if(!file.size||file.size>2*1024**3)throw Error('video_size');
 if(!/^video\//i.test(file.type)&&!(/\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(file.name)))throw Error('video_type');
}
function encoded(value:string){return btoa(Array.from(new TextEncoder().encode(value),byte=>String.fromCharCode(byte)).join(''));}
/** Real TUS bytes: retry only after reading the server's committed offset. */
export async function uploadVideoFile(file:File,auth:DirectUploadResult,onProgress:(percent:number)=>void,signal?:AbortSignal){
 validateVideoFile(file);
 if(auth.uploadUrl!==ENDPOINT||!auth.videoId||!/^\d+$/.test(auth.libraryId)||auth.authorizationExpire<=Date.now()/1000)throw Error('upload_authorization');
 const headers={'Tus-Resumable':'1.0.0',AuthorizationSignature:auth.authorizationSignature,AuthorizationExpire:String(auth.authorizationExpire),VideoId:auth.videoId,LibraryId:auth.libraryId};
 const response=await fetch(ENDPOINT,{method:'POST',headers:{...headers,'Upload-Length':String(file.size),'Upload-Metadata':`filetype ${encoded(file.type||'video/mp4')},filename ${encoded(file.name)}`},signal,redirect:'error'});
 if(response.status!==201)throw Error('upload_creation');
 const location=response.headers.get('Location');if(!location)throw Error('upload_location');
 const url=new URL(location,ENDPOINT);if(url.origin!==new URL(ENDPOINT).origin||!url.pathname.startsWith('/tusupload/'))throw Error('upload_location');
 let offset=0,retries=0;const chunkSize=8*1024*1024;onProgress(0);
 while(offset<file.size){
  try{
   const end=Math.min(offset+chunkSize,file.size);
   const patch=await fetch(url,{method:'PATCH',headers:{...headers,'Content-Type':'application/offset+octet-stream','Upload-Offset':String(offset)},body:file.slice(offset,end),signal,redirect:'error'});
   if(patch.status!==204)throw Error('upload_chunk');
   const next=Number(patch.headers.get('Upload-Offset'));if(!patch.headers.has('Upload-Offset')||!Number.isSafeInteger(next)||next!==end)throw Error('upload_offset');
   offset=next;retries=0;onProgress(Math.floor(offset/file.size*100));
  }catch(error){
   if(signal?.aborted||++retries>3)throw error;
   const head=await fetch(url,{method:'HEAD',headers,signal,redirect:'error'});
   const committed=Number(head.headers.get('Upload-Offset'));
   if(!head.ok||!head.headers.has('Upload-Offset')||!Number.isSafeInteger(committed)||committed<offset||committed>file.size)throw Error('upload_resume');
   offset=committed;onProgress(Math.floor(offset/file.size*100));
  }
 }
}
