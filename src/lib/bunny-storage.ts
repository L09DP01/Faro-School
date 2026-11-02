/** Region of the existing Faro School Storage zone, verified in the Bunny dashboard. */
export function bunnyStorageConnection(){
  const zone=process.env.BUNNY_STORAGE_ZONE_NAME?.trim();
  const key=process.env.BUNNY_STORAGE_API_KEY?.trim();
  const region=(process.env.BUNNY_STORAGE_REGION||'ny').trim().toLowerCase();
  // Never send the Storage credential to an arbitrary configurable hostname.
  if(!zone||!key||!['de','ny','la','sg','syd','uk','se','jh'].includes(region))return null;
  const host=region==='de'?'storage.bunnycdn.com':`${region}.storage.bunnycdn.com`;
  return {url:`https://${host}/${encodeURIComponent(zone)}`,key};
}
