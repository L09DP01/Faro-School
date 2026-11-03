import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

let clientInstance: SupabaseClient | null = null;
let tokenRequest:Promise<string|null>|null=null;
let authGeneration=0;
let stopRealtimeWake:(()=>void)|null=null;
let realtimeTokenRefresh: ReturnType<typeof setInterval>|null=null;

/**
 * Creates or retrieves Supabase client for browser usage.
 * Pure Supabase client without legacy cookie dependencies.
 */
export function createClient(accessToken?: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "mock-anon-key";

  if (accessToken) {
    return createSupabaseClient(url, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          apikey: anonKey,
        },
      },
    });
  }

  if (!clientInstance) {
    clientInstance = createSupabaseClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          apikey: anonKey,
        },
      },
    });
  }
  return clientInstance;
}

/**
 * Fetches short-lived Supabase JWT minted by Auth.js session
 * from authenticated GET /api/auth/supabase-token endpoint.
 */
export async function getSupabaseToken(): Promise<string | null> {
 if(tokenRequest)return tokenRequest;
 tokenRequest=(async()=>{try{const response=await fetch('/api/auth/supabase-token',{cache:'no-store'});if(!response.ok)return null;const value=await response.json();return typeof value.token==='string'?value.token:null;}catch{return null;}})();
 const pending=tokenRequest;try{return await pending;}finally{if(tokenRequest===pending)tokenRequest=null;}
}

/**
 * Initializes Supabase client with authenticated token for Realtime & RLS.
 */
export async function initAuthenticatedRealtimeClient(): Promise<SupabaseClient> {
 const generation=authGeneration,token=await getSupabaseToken();
 if(!token||generation!==authGeneration)throw new Error('realtime_unauthorized');
 const client=createClient();await client.realtime.setAuth(token);
 if(typeof window!=='undefined'&&!realtimeTokenRefresh){
  const refresh=()=>{if(document.visibilityState==='hidden')return;void getSupabaseToken().then(next=>{if(generation!==authGeneration)return;if(next){void client.realtime.setAuth(next);client.realtime.connect();}else void client.removeAllChannels();});};
  realtimeTokenRefresh=setInterval(refresh,4*60*1000);window.addEventListener('online',refresh);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  stopRealtimeWake=()=>{window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
 }
 return client;
}
if(typeof window!=='undefined')window.addEventListener('faro:logout',()=>{
 authGeneration++;tokenRequest=null;stopRealtimeWake?.();stopRealtimeWake=null;if(realtimeTokenRefresh)clearInterval(realtimeTokenRefresh);realtimeTokenRefresh=null;
 void clientInstance?.removeAllChannels();clientInstance=null;
});
