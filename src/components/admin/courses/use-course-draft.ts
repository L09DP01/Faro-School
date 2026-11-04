"use client";
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {draftStorageKey,readCourseDraft,type CourseDraft} from '@/lib/admin/course-draft';
export function useCourseDraft(owner:string|undefined,id:string|undefined,data:CourseDraft,restore:(value:CourseDraft)=>void){
 const key=owner?draftStorageKey(owner,id):null,latest=useRef(data),restorer=useRef(restore),stopped=useRef(false);
 latest.current=data;restorer.current=restore;
 const[ready,setReady]=useState(false),[state,setState]=useState<'loading'|'saved'|'restored'|'error'>('loading');
 const fingerprint=JSON.stringify(data),previous=useRef<string|null>(null),scope=useRef(key);
 useLayoutEffect(()=>{if(scope.current!==key){setReady(false);return;}stopped.current=false;previous.current=null;try{const raw=key?localStorage.getItem(key):null;const saved=readCourseDraft(raw);if(saved){previous.current=JSON.stringify(saved);restorer.current(saved);setState('restored');}else{previous.current=JSON.stringify(latest.current);setState(raw||!key?'error':'saved');}}catch{setState('error');}setReady(true);},[key]);
 useLayoutEffect(()=>{if(!ready||!key||scope.current!==key||stopped.current||previous.current===fingerprint)return;try{localStorage.setItem(key,JSON.stringify({version:1,data:latest.current}));previous.current=fingerprint;setState('saved');}catch{setState('error');}},[ready,key,fingerprint]);
 useEffect(()=>{const flush=()=>{if(!key||!ready||scope.current!==key||stopped.current||JSON.stringify(latest.current)===previous.current)return;try{localStorage.setItem(key,JSON.stringify({version:1,data:latest.current}));}catch{setState('error');}};window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',flush);return()=>{flush();window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',flush);};},[key,ready]);
 const snapshot=()=>JSON.stringify(latest.current);
 const clear=(expected?:string)=>{if(expected!==undefined&&expected!==snapshot())return false;stopped.current=true;if(key)try{localStorage.removeItem(key);}catch{}return true;};
 return{ready,state,clear,snapshot};
}
