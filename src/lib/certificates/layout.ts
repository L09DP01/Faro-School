// Shared PDF and SVG layout. A4 points, origin at the top-left.
// Matches the user-approved ornate certificate reference (1491 × 1055).
export const CERTIFICATE_LAYOUT = {
 width:841.89,height:595.28,frame:15,contentWidth:690,
 background:"/brand/certificates/ornate-template.png",
 title:{y:152,size:32,initialSize:38.5,maxWidth:460},intro:{y:200,size:13.2},
 name:{y:265,size:52.3,maxWidth:650},
 completion:{y:313,size:12.5},course:{y:358,size:31.5,lineHeight:23,maxWidth:660},
 details:{y:405,size:12},date:{x:78,y:490,labelOffset:17,size:12},
 qr:{x:267,y:428,size:72},number:{x:303,y:512},
 signature:{x:540,y:431,width:118,height:32,nameY:477,titleY:492},
 footer:{y:554,size:7.2,ruleY:541,ruleLeft:195,ruleRight:648},
 revoked:{y:419,size:10},
 fonts:{bold:"/fonts/certificates/Tinos-Bold.ttf",italic:"/fonts/certificates/Tinos-BoldItalic.ttf",body:"/fonts/certificates/Inter-Regular.ttf",bodyBold:"/fonts/certificates/Inter-Bold.ttf"},
} as const;
export const CERTIFICATE_FR = {
 revoked:"CERTIFICAT RÉVOQUÉ",title:"CERTIFICAT DE RÉUSSITE",intro:"Faro School certifie que",
 completion:"a suivi avec succès la formation",date:"Délivré le",verify:"Vérifier l’authenticité",
 details:(hours:number,instructor:string)=>`${new Intl.NumberFormat("fr-FR",{maximumFractionDigits:1}).format(hours)} heures de contenu – dispensée par ${instructor}`,
 footer:"Certificat privé délivré par Faro School attestant l’achèvement d’une formation en ligne. Il ne constitue pas un diplôme d’État.",
} as const;
export function frenchDate(date:string){return new Intl.DateTimeFormat("fr-FR",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(date));}
export function fitSize(text:string,measure:(s:string,size:number)=>number,maxWidth:number,initial:number){
 return Math.min(initial,initial*maxWidth/Math.max(measure(text,initial),1));
}
export function courseLineY(index:number,count:number){return CERTIFICATE_LAYOUT.course.y-(count-1)*CERTIFICATE_LAYOUT.course.lineHeight/2+index*CERTIFICATE_LAYOUT.course.lineHeight;}
export function wrapCourse(text:string,measure:(s:string,size:number)=>number){
 const {maxWidth,size:initial}=CERTIFICATE_LAYOUT.course;
 for(let size=initial;size>=7;size-=.5){
  const lines:string[]=[];let line="";
  for(const word of text.trim().split(/\s+/)){
   if(line&&measure(`${line} ${word}`,size)>maxWidth){lines.push(line);line=word;}else line=line?`${line} ${word}`:word;
  }
  if(line)lines.push(line);
  if(lines.length<=2&&lines.every(l=>measure(l,size)<=maxWidth))return{lines,size};
 }
 return{lines:[text],size:fitSize(text,measure,maxWidth,7)};
}

// The reference title uses large initials with small capitals.
export function certificateTitleParts(){
 const title=CERTIFICATE_FR.title,second=title.indexOf("RÉUSSITE");
 return [{text:title.slice(0,1),size:CERTIFICATE_LAYOUT.title.initialSize},{text:title.slice(1,second),size:CERTIFICATE_LAYOUT.title.size},{text:title.slice(second,second+1),size:CERTIFICATE_LAYOUT.title.initialSize},{text:title.slice(second+1),size:CERTIFICATE_LAYOUT.title.size}];
}
