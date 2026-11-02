/** Repair covers returned by older deployments before sending a Server Action. */
export async function prepareCourseCover(url:string):Promise<string>{
  if(!url.startsWith('data:'))return url;
  const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(url);
  if(!match||match[2].length>4*1024*1024)throw Error('invalid_image');
  const raw=atob(match[2]),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  const form=new FormData();form.append('file',new File([bytes],'cover',{type:match[1]}));
  const response=await fetch('/api/admin/upload/cover',{method:'POST',body:form,signal:AbortSignal.timeout(30000)});
  const data=await response.json();
  if(!response.ok||typeof data.url!=='string'||data.url.startsWith('data:'))throw Error('cover_upload_failed');
  return data.url;
}
