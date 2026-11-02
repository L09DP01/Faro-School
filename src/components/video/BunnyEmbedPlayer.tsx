"use client";
import Script from 'next/script';
import {useEffect,useRef,useState} from 'react';

interface PlayerApi{on(event:string,callback:(data:any)=>void):void;off(event:string):void;pause():void;getDuration(callback:(duration:number)=>void):void;setCurrentTime(seconds:number):void}
export function BunnyEmbedPlayer({src,title,initialPositionSec,paused,onProgress}:{src:string;title:string;initialPositionSec:number;paused:boolean;onProgress:(seconds:number,duration:number,save:boolean)=>void}){
 const frame=useRef<HTMLIFrameElement>(null),api=useRef<PlayerApi|null>(null),callback=useRef(onProgress),position=useRef(initialPositionSec),lastSave=useRef(0);
 const [scriptReady,setScriptReady]=useState(false);
 callback.current=onProgress;
 useEffect(()=>{if(!scriptReady||!frame.current)return;let alive=true;const Constructor=(window as any).playerjs?.Player;if(!Constructor)return;const player:PlayerApi=new Constructor(frame.current);api.current=player;
  player.on('ready',()=>{if(!alive)return;player.getDuration(duration=>{if(!alive)return;if(position.current>0&&position.current<duration-3)player.setCurrentTime(position.current);callback.current(position.current,duration,false);});
   player.on('timeupdate',data=>{if(!alive||!Number.isFinite(data?.seconds)||!Number.isFinite(data?.duration))return;position.current=data.seconds;const save=Date.now()-lastSave.current>=10000;if(save)lastSave.current=Date.now();callback.current(data.seconds,data.duration,save);});
   player.on('pause',()=>{if(alive)callback.current(position.current,0,true);});
   player.on('ended',()=>{if(alive)player.getDuration(duration=>callback.current(duration,duration,true));});
  });
  return()=>{alive=false;for(const event of ['ready','timeupdate','pause','ended'])player.off(event);api.current=null;};
 },[src,scriptReady]);
 useEffect(()=>{if(paused)api.current?.pause();},[paused]);
 let safe=false;try{const url=new URL(src);safe=url.protocol==='https:'&&['iframe.mediadelivery.net','player.mediadelivery.net'].includes(url.hostname)&&url.pathname.startsWith('/embed/');}catch{}
 if(!safe)return <p role="alert">Lecteur indisponible.</p>;
 return <><Script src="https://assets.mediadelivery.net/playerjs/playerjs-latest.min.js" strategy="afterInteractive" onReady={()=>setScriptReady(true)}/><iframe ref={frame} src={src+'&autoplay=false&responsive=true'} title={title} className="absolute inset-0 h-full w-full border-0" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/></>;
}
