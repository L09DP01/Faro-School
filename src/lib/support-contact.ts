/** Public contact only; never substitute a fictitious support number or user PII. */
export function supportContact(locale:string){
 const digits=(process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP||"").replace(/\D/g,"");
 const configured=/^\d{8,15}$/.test(digits)&&digits!=="50936000000";
 const message=locale==="ht"?"Bonjou Faro School, mwen bezwen èd pou kont mwen.":"Bonjour Faro School, j’ai besoin d’aide pour mon compte.";
 return {href:configured?`https://wa.me/${digits}?text=${encodeURIComponent(message)}`:"/dashboard/messages",external:configured};
}
