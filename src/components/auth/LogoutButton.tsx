"use client";
import {useState, type ReactNode} from "react";
import {logoutAccountAction} from "@/app/actions/logout";
export function LogoutButton({locale="fr",className,children}:{locale?:string;className?:string;children:ReactNode}){
 const [busy,setBusy]=useState(false),[failed,setFailed]=useState(false);
 async function logout(){
  if(busy)return;setBusy(true);setFailed(false);
  try{window.dispatchEvent(new Event('faro:logout'));const result=await logoutAccountAction(locale);window.location.replace(result.redirectTo);}
  catch{setFailed(true);setBusy(false);}
 }
 return <><button type="button" onClick={logout} disabled={busy} aria-busy={busy} className={className}>{children}</button>{failed&&<p role="alert" className="text-xs text-red">{locale==="ht"?"Dekoneksyon an pa reyisi. Eseye ankò.":"La déconnexion a échoué. Réessayez."}</p>}</>;
}
