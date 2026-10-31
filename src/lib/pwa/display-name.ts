/** Presentation only: preserve the stored identity and certificate snapshots. */
export function greetingName(fullName:string,locale:string){
 const first=fullName.trim().split(/\s+/)[0];
 return first?first.toLocaleLowerCase(locale).replace(/(^|[-’'])[\p{L}]/gu,char=>char.toLocaleUpperCase(locale)):(locale==="ht"?"Aprenan":"Apprenant");
}
