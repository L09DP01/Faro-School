"use client";
import {useEffect} from "react";
import {usePathname} from "next/navigation";
/** No JS heights: CSS dvh owns layout; this component only publishes UI states. */
export function PwaViewport(){
 const pathname=usePathname();
 useEffect(()=>{
  const root=document.documentElement,landing=/^\/(?:fr|ht)?\/?$/.test(pathname);
  root.dataset.appRoute=String(!landing);
  root.dataset.appShell=String(/^\/(?:fr|ht)\/(?:dashboard|admin|certificats)(?:\/|$)/.test(pathname));
  const media=window.matchMedia("(display-mode: standalone)");
  if(process.env.NODE_ENV!=="production"&&!landing){
   const query=new URLSearchParams(window.location.search);
   if(query.get("debug")==="safe"){
    root.dataset.safeDebug="true";
    for(const key of ["sat","sab"]){const value=query.get(key);if(value!==null&&/^\d{1,2}$/.test(value))root.style.setProperty("--"+key,Math.min(80,Number(value))+"px");}
   }
  }
  // Transient reference for keyboard visibility only; never applied to layout/CSS.
  let restingHeight=window.innerHeight,restingWidth=window.innerWidth;
  const update=()=>{
   root.dataset.appStandalone=String(!landing&&(media.matches||(navigator as Navigator&{standalone?:boolean}).standalone===true));
   const active=document.activeElement,editing=active instanceof HTMLElement&&active.matches('input:not([type="checkbox"]):not([type="radio"]),textarea,select,[contenteditable=true]');
   const viewport=window.visualViewport;
   if(!editing||window.innerWidth!==restingWidth){restingHeight=window.innerHeight;restingWidth=window.innerWidth;}
   const reduced=!!viewport&&(window.innerHeight-viewport.height>120||restingHeight-viewport.height>120);
   root.dataset.appKeyboard=String(!landing&&editing&&!!viewport&&viewport.scale===1&&reduced);
   if(viewport?.scale===1&&!reduced)restingHeight=Math.max(restingHeight,window.innerHeight);
  };
  update();media.addEventListener("change",update);window.addEventListener("resize",update);window.addEventListener("pageshow",update);document.addEventListener("visibilitychange",update);document.addEventListener("focusin",update);
  const blur=()=>requestAnimationFrame(update);document.addEventListener("focusout",blur);window.visualViewport?.addEventListener("resize",update);
  return()=>{media.removeEventListener("change",update);window.removeEventListener("resize",update);window.removeEventListener("pageshow",update);document.removeEventListener("visibilitychange",update);document.removeEventListener("focusin",update);document.removeEventListener("focusout",blur);window.visualViewport?.removeEventListener("resize",update);for(const key of ["appRoute","appShell","appStandalone","appKeyboard","safeDebug"])delete root.dataset[key];root.style.removeProperty("--sat");root.style.removeProperty("--sab");};
 },[pathname]);
 return null;
}
