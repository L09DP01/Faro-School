"use client";
import {useEffect,useState,type ReactNode} from "react";
import {createPortal} from "react-dom";
/** Keep viewport-fixed navigation outside every scroll/clip/layout container. */
export function PwaBottomNavPortal({children}:{children:ReactNode}){
 const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);
 return mounted?createPortal(children,document.body):null;
}
