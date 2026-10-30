import { PDFDocument,rgb,beginText,endText,setFillingColor,setFontAndSize,setTextMatrix,showText,type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { CERTIFICATE_LAYOUT as L,CERTIFICATE_FR as T,frenchDate,fitSize,wrapCourse,courseLineY,certificateTitleParts } from "./layout";
import { certificateQr } from "./qr";
import type { Certificate } from "./shared";

// Print equivalents of the certificate semantic tokens. UI uses CSS tokens only.
export const PRINT_PALETTE={navy:[3/255,16/255,71/255],orange:[1,117/255,10/255],muted:[91/255,100/255,120/255]} as const;
export interface CertificateAssets{bold:Uint8Array;italic:Uint8Array;body:Uint8Array;bodyBold:Uint8Array;background:Uint8Array;signature?:Uint8Array}
export async function renderCertificatePdf(cert:Certificate,verification:string,assets:CertificateAssets){
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 doc.setTitle(T.title);doc.setAuthor("Faro School");doc.setLanguage("fr-FR");
 const page=doc.addPage([L.width,L.height]);
 const [bold,italic,body,bodyBold]=await Promise.all([doc.embedFont(assets.bold,{subset:true}),doc.embedFont(assets.italic,{subset:true}),doc.embedFont(assets.body,{subset:false}),doc.embedFont(assets.bodyBold,{subset:false})]);
 const navy=rgb(...PRINT_PALETTE.navy),orange=rgb(...PRINT_PALETTE.orange),muted=rgb(...PRINT_PALETTE.muted);
 const textAt=(text:string,x:number,y:number,size:number,font:PDFFont,color=navy,maxWidth=190,center=false)=>{
  const fitted=fitSize(text,(s,z)=>font.widthOfTextAtSize(s,z),maxWidth,size);
  page.drawText(text,{x:center?x-font.widthOfTextAtSize(text,fitted)/2:x,y:L.height-y,size:fitted,font,color});
 };
 const centered=(text:string,y:number,size:number,font:PDFFont,color=navy,maxWidth=L.contentWidth as number)=>textAt(text,L.width/2,y,size,font,color,maxWidth,true);
 const background=await doc.embedPng(assets.background);
 page.drawImage(background,{x:0,y:0,width:L.width,height:L.height});
 const titleParts=certificateTitleParts();
 const titleX=(L.width-titleParts.reduce((w,p)=>w+bold.widthOfTextAtSize(p.text,p.size),0))/2;
 const titleFont=page.node.newFontDictionary(bold.name,bold.ref);
 // One text object keeps the small-cap heading searchable as a complete sentence.
 page.pushOperators(beginText(),setFillingColor(navy),setTextMatrix(1,0,0,1,titleX,L.height-L.title.y),...titleParts.flatMap(part=>[setFontAndSize(titleFont,part.size),showText(bold.encodeText(part.text))]),endText());
 centered(T.intro,L.intro.y,L.intro.size,body,muted);
 centered(cert.student_name,L.name.y,L.name.size,italic,orange,L.name.maxWidth);
 centered(T.completion,L.completion.y,L.completion.size,body,muted);
 const course=wrapCourse(cert.course_title,(s,z)=>bold.widthOfTextAtSize(s,z));
 course.lines.forEach((line,i)=>centered(line,courseLineY(i,course.lines.length),course.size,bold,navy,L.course.maxWidth));
 centered(T.details(Number(cert.content_hours),cert.instructor_name),L.details.y,L.details.size,body,muted,680);
 if(cert.revoked_at)centered(T.revoked,L.revoked.y,L.revoked.size,bodyBold,orange);
 textAt(T.date,L.date.x,L.date.y-L.date.labelOffset,9,body,muted);
 textAt(frenchDate(cert.issued_at),L.date.x,L.date.y,L.date.size,bodyBold,navy,145);
 const qr=certificateQr(verification),quiet=4,cell=L.qr.size/(qr.size+quiet*2);
 // Vector QR with four-module quiet zone: 72pt = 25.4mm on A4.
 page.drawRectangle({x:L.qr.x,y:L.height-L.qr.y-L.qr.size,width:L.qr.size,height:L.qr.size,color:rgb(1,1,1)});
 for(let y=0;y<qr.size;y++)for(let x=0;x<qr.size;x++)if(qr.data[y*qr.size+x])page.drawRectangle({x:L.qr.x+(x+quiet)*cell,y:L.height-L.qr.y-(y+quiet+1)*cell,width:cell+.01,height:cell+.01,color:navy});
 textAt(cert.certificate_number,L.number.x,L.number.y,8.6,body,navy,144,true);
 textAt(T.verify,L.number.x,L.number.y+13,8.2,body,navy,144,true);
 if(assets.signature){const image=await doc.embedPng(assets.signature),s=image.scaleToFit(L.signature.width,L.signature.height);page.drawImage(image,{x:L.signature.x+(L.signature.width-s.width)/2,y:L.height-L.signature.y-s.height,...s});}
 textAt(cert.signature_name,L.signature.x+L.signature.width/2,L.signature.nameY,11,bodyBold,navy,170,true);
 textAt(cert.signature_title,L.signature.x+L.signature.width/2,L.signature.titleY,8.8,body,navy,170,true);
 const f=L.footer,cx=L.width/2;
 for(const [x1,x2] of [[f.ruleLeft,cx-10],[cx+10,f.ruleRight]])page.drawLine({start:{x:x1,y:L.height-f.ruleY},end:{x:x2,y:L.height-f.ruleY},color:orange,thickness:.4,opacity:.5});
 page.drawSvgPath("M 0 -3.6 L 3.6 0 L 0 3.6 L -3.6 0 Z",{x:cx,y:L.height-f.ruleY,color:orange});
 centered(T.footer,L.footer.y,L.footer.size,body,muted,740);
 return doc.save();
}
export async function loadCertificateAssets(base:string,signaturePath?:string|null):Promise<CertificateAssets>{
 const get=async(path:string)=>{const res=await fetch(new URL(path,base),{cache:"no-store"});if(!res.ok)throw new Error("certificate_asset_unavailable");return new Uint8Array(await res.arrayBuffer());};
 const [bold,italic,body,bodyBold,background]=await Promise.all([get(L.fonts.bold),get(L.fonts.italic),get(L.fonts.body),get(L.fonts.bodyBold),get(L.background)]);
 let signature:Uint8Array|undefined;
 if(signaturePath&&/^certificates\/signatures\/[a-zA-Z0-9-]+\.png$/.test(signaturePath)){
  const host=process.env.BUNNY_STORAGE_CDN_HOSTNAME;
  if(host){const response=await fetch(`https://${host}/${signaturePath}`,{cache:"no-store",redirect:"error"});if(!response.ok)throw new Error("signature_unavailable");signature=new Uint8Array(await response.arrayBuffer());}
 }
 return{bold,italic,body,bodyBold,background,signature};
}
