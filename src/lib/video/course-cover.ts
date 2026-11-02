import {bunnyStorageConnection} from '@/lib/bunny-storage';
/** Public artwork prefix; private learning resources must never be stored here. */
export function coverStorage(){
  const storage=bunnyStorageConnection();
  return storage?{url:`${storage.url}/courses/covers`,key:storage.key}:null;
}
export function validCoverBytes(bytes:Uint8Array,type:string):'png'|'jpg'|'webp'|null{
  if(type==='image/png'&&bytes.length>=33&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'png';
  if(type==='image/jpeg'&&bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpg';
  if(type==='image/webp'&&bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'webp';
  return null;
}
