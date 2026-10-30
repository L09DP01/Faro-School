"use client";
import {useEffect,useId,useState} from "react";
import {CERTIFICATE_LAYOUT as L,CERTIFICATE_FR as T,frenchDate,fitSize,wrapCourse,courseLineY,certificateTitleParts} from "@/lib/certificates/layout";
import {certificateQr} from "@/lib/certificates/qr";
import type {Certificate} from "@/lib/certificates/shared";
type Face="heading"|"italic"|"body"|"bodyBold";
const fontFace={heading:"700 1px FaroCertificateHeading",italic:"italic 700 1px FaroCertificateItalic",body:"400 1px FaroCertificateBody",bodyBold:"700 1px FaroCertificateBodyBold"};
export function CertificatePreview({certificate:c,url,signatureUrl}:{certificate:Certificate;url:string;signatureUrl?:string}){
 const id=useId(),[ready,setReady]=useState(false);
 useEffect(()=>{let active=true;void Promise.all(Object.values(fontFace).map(font=>document.fonts.load(font))).then(()=>{if(active)setReady(true);});return()=>{active=false;};},[]);
 const measure=(s:string,size:number,face:Face="heading")=>{
  if(typeof document==="undefined"||!ready)return s.length*size*(face==="heading"||face==="italic"?.55:.58);
  const ctx=document.createElement("canvas").getContext("2d")!;
  ctx.font=fontFace[face].replace("1px",`${size}px`);return ctx.measureText(s).width;
 };
 const fit=(s:string,size:number,width:number,face:Face="body")=>fitSize(s,(t,z)=>measure(t,z,face),width,size);
 const titleParts=certificateTitleParts();
 const course=wrapCourse(c.course_title,measure),qr=certificateQr(url),cell=L.qr.size/(qr.size+8);
 const details=T.details(Number(c.content_hours),c.instructor_name),date=frenchDate(c.issued_at),sx=L.signature.x+L.signature.width/2;
 return <svg role="img" aria-labelledby={id} lang="fr" viewBox={`0 0 ${L.width} ${L.height}`} className="w-full h-auto bg-surface text-navy-deep" xmlns="http://www.w3.org/2000/svg">
  <title id={id}>{T.title} — {c.student_name}</title>
  <image href={L.background} x="0" y="0" width={L.width} height={L.height} preserveAspectRatio="none"/>
  <g textAnchor="middle" fill="var(--navy-deep)" fontFamily="FaroCertificateHeading, serif" fontWeight="700">
   <text x={L.width/2} y={L.title.y}>{titleParts.map((part,i)=><tspan key={i} fontSize={part.size}>{part.text}</tspan>)}</text>
   <text x={L.width/2} y={L.intro.y} fontSize={L.intro.size} fontFamily="FaroCertificateBody, sans-serif" fontWeight="400" fill="var(--certificate-muted)">{T.intro}</text>
   <text x={L.width/2} y={L.name.y} fontSize={fit(c.student_name,L.name.size,L.name.maxWidth,"italic")} fill="var(--certificate-orange)" fontFamily="FaroCertificateItalic, serif" fontStyle="italic" fontWeight="700">{c.student_name}</text>
   <text x={L.width/2} y={L.completion.y} fontSize={L.completion.size} fontFamily="FaroCertificateBody, sans-serif" fontWeight="400" fill="var(--certificate-muted)">{T.completion}</text>
   {course.lines.map((line,i)=><text key={i} x={L.width/2} y={courseLineY(i,course.lines.length)} fontSize={course.size}>{line}</text>)}
   <text x={L.width/2} y={L.details.y} fontSize={fit(details,L.details.size,680)} fontFamily="FaroCertificateBody, sans-serif" fontWeight="400" fill="var(--certificate-muted)">{details}</text>
   {c.revoked_at?<text x={L.width/2} y={L.revoked.y} fontSize={L.revoked.size} fill="var(--certificate-orange)" fontFamily="FaroCertificateBodyBold, sans-serif">{T.revoked}</text>:null}
  </g>
  <g fill="var(--navy-deep)" fontFamily="FaroCertificateBody, sans-serif" fontWeight="400" fontSize="9">
   <text x={L.date.x} y={L.date.y-L.date.labelOffset} fill="var(--certificate-muted)">{T.date}</text>
   <text x={L.date.x} y={L.date.y} fontFamily="FaroCertificateBodyBold, sans-serif" fontWeight="700" fontSize={fit(date,L.date.size,145,"bodyBold")}>{date}</text>
   <rect x={L.qr.x} y={L.qr.y} width={L.qr.size} height={L.qr.size} fill="var(--surface)"/>
   {Array.from(qr.data).map((value,i)=>value?<rect key={i} x={L.qr.x+(i%qr.size+4)*cell} y={L.qr.y+(Math.floor(i/qr.size)+4)*cell} width={cell+.01} height={cell+.01}/>:null)}
   <text x={L.number.x} y={L.number.y} textAnchor="middle" fontSize={fit(c.certificate_number,8.6,144)}>{c.certificate_number}</text>
   <text x={L.number.x} y={L.number.y+13} textAnchor="middle" fontSize="8.2">{T.verify}</text>
   {signatureUrl?<image href={signatureUrl} x={L.signature.x} y={L.signature.y} width={L.signature.width} height={L.signature.height} preserveAspectRatio="xMidYMid meet"/>:null}
   <text x={sx} y={L.signature.nameY} textAnchor="middle" fontSize={fit(c.signature_name,11,170,"bodyBold")} fontFamily="FaroCertificateBodyBold, sans-serif" fontWeight="700">{c.signature_name}</text>
   <text x={sx} y={L.signature.titleY} textAnchor="middle" fontSize={fit(c.signature_title,8.8,170)}>{c.signature_title}</text>
   <path d={`M ${L.footer.ruleLeft} ${L.footer.ruleY} H ${L.width/2-10} M ${L.width/2+10} ${L.footer.ruleY} H ${L.footer.ruleRight}`} stroke="var(--certificate-orange)" strokeWidth=".4" opacity=".5" fill="none"/>
   <path d={`M ${L.width/2} ${L.footer.ruleY-3.6} l 3.6 3.6 l -3.6 3.6 l -3.6 -3.6 Z`} fill="var(--certificate-orange)"/>
   <text x={L.width/2} y={L.footer.y} textAnchor="middle" fontSize={fit(T.footer,L.footer.size,740)} fill="var(--certificate-muted)">{T.footer}</text>
  </g>
 </svg>;
}
