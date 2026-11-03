import type{SupportPlan}from'./types';
export function normalize(text:string){return text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,' ').trim();}
export function detectLanguage(text:string,fallback:string='fr'):'fr'|'ht'|'en'{const value=normalize(text);if(/\b(mwen|ou ka|yon|peman|achte|bezwen|m pa|paka|pa mache|wi|responsab)\b/.test(value))return'ht';if(/\b(i need|i want|my payment|i paid|can you|human support|where is my|yes please)\b/.test(value))return'en';if(/\b(je |j ai|paiement|bonjour|oui|commande|erreur)\b/.test(value))return'fr';return fallback==='ht'?'ht':fallback==='en'?'en':'fr';}
export function fallbackPlan(question:string,history:{senderType:string;body:string}[],memory:any,locale:string):SupportPlan{
 const text=normalize(question),previous=normalize(history.filter(m=>m.senderType==='student').slice(-6).map(m=>m.body).join(' ')),all=previous+' '+text;
 const human=/(humain|human|admin|responsab|direksyon|moun reyel|real person)/.test(text)&&/(vle|bezwen|veux|souhaite|parler|contact|connect|konekt|konetk|transmet|need|want|pale|resout|rezoud|aide|ede)/.test(text);
 const confirm=memory?.transferOffered===true&&/^(oui|wi|yes|okay|ok|dako)(?:[ ,.!]+(?:merci|please|svp|silvouple|souple|bien sur|tanpri))*[ .!]*$/.test(text);
 const explicit=(human&&/(contactez|connect|konekt|konetk|transmet|ouvrez|kreye|open|kontak)/.test(text))||/((ouvrir|ouvrez|kreye|open).{0,20}(ticket|tike))/.test(text);
 const choose=(value:string)=>/(paiement|peman|payment|debite|debited|peye|paye|moncash|natcash|achat|acheter|achte)/.test(value)?'payments':/(certificat|setifika|certificate|quiz|test)/.test(value)?'assessment':/(video|videyo|pdf)/.test(value)?'media':/(catalogue|catalog|available courses|disponib)/.test(value)?'catalog':/(cours|kou|course|formation)/.test(value)?'access':/(connexion|modpas|password|compte|kont mwen|account)/.test(value)?'accounts':null;
 const category=choose(text)||memory?.category||choose(previous)||'support';
 const tried=/deja|already|sa pa|pa mache|ne fonctionne|l ai fait|still|toujours|encore|not work|donne erreur|error/.test(text)&&history.length>0;
 const debited=category==='payments'&&(!!memory?.debited||(/(debite|debited|deja peye|retire|charged|kob.*soti|lajan.*soti)/.test(text)&&!/(pas.*debite|not.*charged|pa.*debite)/.test(text)));
 const tools=category==='payments'?['get_my_orders','get_my_payment_status','get_my_enrollments']:category==='assessment'?['get_my_certificates','get_my_learning_progress','get_my_enrollments','get_available_courses']:category==='access'?['get_my_enrollments','get_my_course_access']:category==='catalog'?['get_available_courses']:[];
 return{intent:human||confirm?'HUMAN_REQUEST':tried?'FOLLOW_UP':/erreur|pa mache|fail|paka|pas.*arriv|can.t/.test(text)?'TROUBLESHOOTING':/statut|status|mes |my |mwen/.test(text)?'ACCOUNT_LOOKUP':'GUIDANCE',language:detectLanguage(question,memory?.language||locale),query:category==='payments'?'achat paiement Kobara erreur debit commande':category==='access'?'retrouver formation inscription acces':category==='assessment'?'certificat quiz progression conditions':question.slice(0,300),category,tools:tools as SupportPlan['tools'],stage:debited?'after':memory?.stage||(/erreur|error|peman|paiement/.test(text)?'during':'unknown'),debited,alreadyTried:tried||!!memory?.alreadyTried,human:confirm?'confirm':explicit?'open':human?'offer':'none',otherAccount:/autre (compte|eleve)|another (student|account)|kont yon lot|kont lot moun|email.*ami/.test(text)};
}
export function sameReply(a:string,b:string){return normalize(a).replace(/\W/g,'')===normalize(b).replace(/\W/g,'');}
export function say(language:string,fr:string,ht:string,en:string){return language==='ht'?ht:language==='en'?en:fr;}

/** Ticket permission is determined by the server, independently of model output. */
export function isSupportGreeting(question:string){
 const text=normalize(question).replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
 return /^(salut|bonjour|bonsoir|bonjou|bonswa|hello|hi|hey|coucou|salut tout le monde)$/.test(text);
}
export function supportTicketConsent(question:string,memory:any,buttonRequested=false):'button'|'explicit'|'confirmation'|null{
 if(isSupportGreeting(question))return null;
 const text=normalize(question);
 if(/\b(?:ne|n)\b.{0,45}\b(?:pas|plus)\b|je.{0,20}pas.{0,35}(?:ticket|humain|admin)|don't|do not|dont|pa vle|pa kreye|pa ouvri|pas de ticket|sans ticket|no ticket|not yet|non merci/.test(text))return null;
 if(/(?:comment|how to|kijan|explique|affiche|il est ecrit|exemple|example|says).{0,45}(?:ouvrir|creer|open|kreye|ticket|tike)/.test(text))return null;
 if(buttonRequested&&['je demande un administrateur : creer un ticket support.','mwen mande yon administrate : kreye yon tike sipo.'].includes(text))return 'button';
 const ticket=/(?:^(?:ouvrez|creez|ouvrir|creer|open|kreye|ouvri)\b|(?:je (?:veux|souhaite|demande)|j aimerais|peux tu|pouvez vous|mwen (?:vle|bezwen)|ou ka|please|can you|i (?:want|need)).{0,30}(?:ouvrir|creer|open|kreye|ouvri)).{0,30}(?:ticket|tike)/.test(text);
 if(ticket)return 'explicit';
 const decision=fallbackPlan(question,[],memory,'fr').human;
 const connect=/(?:humain|human|admin|responsab|direksyon)/.test(text)&&/(?:contactez|connect|konekt|konetk|transmet|kontak|mettez|transf)/.test(text);
 return decision==='open'&&connect?'explicit':decision==='confirm'?'confirmation':null;
}
