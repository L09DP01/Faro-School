import {after} from 'next/server';
/** Next/OpenNext attaches this work to the request lifetime via waitUntil. */
export async function scheduleAssistant(work:()=>Promise<void>){try{after(work);}catch{await work();}}
