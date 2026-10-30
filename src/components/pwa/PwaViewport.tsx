'use client';
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
/** Layout mode uses the actual display mode, never the navigation-preference cookie. */
export function PwaViewport(){
 const pathname=usePathname();
 useEffect(()=>{
  const root=document.documentElement;
  const landing=/^\/(?:fr|ht)?\/?$/.test(pathname);
  root.dataset.appRoute=String(!landing);
  root.dataset.appShell=String(/^\/(?:fr|ht)\/(?:dashboard|admin|certificats)(?:\/|$)/.test(pathname));
  const media=window.matchMedia('(display-mode: standalone)');
  const update=()=>{
   const standalone=media.matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
   root.dataset.appStandalone=String(standalone&&!landing);
   const viewport=window.visualViewport;
   // Pinch zoom remains available; changing the layout while zoomed would fight the gesture.
   // CSS dvh owns the full screen, including safe areas. Only override for the keyboard.
   const editing=document.activeElement instanceof HTMLElement && document.activeElement.matches('input,textarea,select,[contenteditable=true]');
   if(viewport?.scale===1 && editing && window.innerHeight-viewport.height>120){
    root.style.setProperty('--app-height',`${viewport.height}px`);
   }else root.style.removeProperty('--app-height');
   if(standalone&&!landing&&viewport&&viewport.scale===1){
    requestAnimationFrame(()=>{const focused=document.activeElement;if(focused instanceof HTMLElement&&focused.matches('input,textarea,select,[contenteditable=true]'))focused.scrollIntoView({block:'nearest',inline:'nearest'});});
   }
  };
  update();media.addEventListener('change',update);window.addEventListener('resize',update);window.addEventListener('focusout',update);window.visualViewport?.addEventListener('resize',update);
  return()=>{media.removeEventListener('change',update);window.removeEventListener('resize',update);window.removeEventListener('focusout',update);window.visualViewport?.removeEventListener('resize',update);delete root.dataset.appRoute;delete root.dataset.appShell;delete root.dataset.appStandalone;root.style.removeProperty('--app-height');};
 },[pathname]);
 return null;
}
