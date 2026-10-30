"use client";
import {useState, type ReactNode} from "react";
import {signOut} from "next-auth/react";
export function LogoutButton({locale="fr",className,children}:{locale?:string;className?:string;children:ReactNode}){
 const [busy,setBusy]=useState(false),[failed,setFailed]=useState(false);
 async function logout(){
  if(busy)return;setBusy(true);setFailed(false);
  try{await signOut({redirect:false});window.location.replace(`/${locale}/connexion`);}
  catch{setFailed(true);setBusy(false);}
 }
 return <><button type="button" onClick={logout} disabled={busy} aria-busy={busy} className={className}>{children}</button>{failed&&<p role="alert" className="text-xs text-red">{locale==="ht"?"Dekoneksyon an pa reyisi. Eseye ankò.":"La déconnexion a échoué. Réessayez."}</p>}</>;
}
