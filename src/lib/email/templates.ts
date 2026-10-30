export const EMAIL_TIMES={verificationMinutes:10,resetHours:1,invitationHours:48} as const;
export function escapeHtml(value:string){return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
export interface TemplateInput {kind:string;locale:string;code?:string;url?:string;name?:string;course?:string;amount?:string;detail?:string;receiptUrl?:string}
export function renderEmail(input:TemplateInput){
 const h=input.locale==='ht';
 const texts:Record<string,[string,string,string,string]>={
 verification:['Confirmez votre adresse e-mail','Konfime adrès imèl ou',`Voici votre code de vérification. Valable ${EMAIL_TIMES.verificationMinutes} minutes.`,`Men kòd verifikasyon ou. Li valab ${EMAIL_TIMES.verificationMinutes} minit.`],
 email_change:['Confirmez votre nouvelle adresse e-mail','Konfime nouvo adrès imèl ou',`Voici votre code de vérification. Valable ${EMAIL_TIMES.verificationMinutes} minutes.`,`Men kòd verifikasyon ou. Li valab ${EMAIL_TIMES.verificationMinutes} minit.`],
 reset:['Réinitialisation de votre mot de passe','Reyinisyalize modpas ou',`Choisissez un nouveau mot de passe. Ce lien est valable ${EMAIL_TIMES.resetHours} heure.`,`Chwazi yon nouvo modpas. Lyen sa a valab ${EMAIL_TIMES.resetHours} èdtan.`],
 invitation:['Votre invitation Faro School','Envitasyon Faro School ou',`Bienvenue ! Choisissez votre mot de passe pour activer votre compte formateur. Ce lien est valable ${EMAIL_TIMES.invitationHours} heures.`,`Byenveni ! Chwazi modpas ou pou aktive kont fòmatè ou. Lyen sa a valab ${EMAIL_TIMES.invitationHours} èdtan.`],
 registration_alert:['Sécurité de votre compte Faro School','Sekirite kont Faro School ou','Une inscription a été demandée avec votre adresse. Si ce n’était pas vous, ignorez ce message.','Yon moun mande enskripsyon ak adrès ou. Si se pa ou, inyore mesaj sa a.'],
 security:['Modification de sécurité sur votre compte','Chanjman sekirite nan kont ou','Une modification de sécurité a été effectuée sur votre compte. Contactez le support si vous ne l’avez pas demandée.','Gen yon chanjman sekirite ki fèt nan kont ou. Kontakte sipò si ou pa t mande sa.'],
 payment_confirmed:['Paiement confirmé','Peman konfime','Votre paiement est confirmé et votre formation est accessible.','Peman ou konfime epi ou ka jwenn fòmasyon ou.'],
 payment_failed:['Paiement non finalisé','Peman pa finalize','Votre paiement n’a pas été finalisé. Vous pouvez réessayer depuis la formation.','Peman ou pa finalize. Ou ka eseye ankò depi paj fòmasyon an.'],
 access_revoked:['Modification de votre accès','Chanjman nan aksè ou','Votre accès à cette formation a été retiré ou remboursé. Contactez le support pour toute question.','Aksè ou nan fòmasyon sa a retire oswa ranbouse. Kontakte sipò pou kesyon.'],
 certificate:['Votre certificat Faro School est prêt','Sètifika Faro School ou a pare','Votre certificat est disponible dans votre espace personnel.','Sètifika ou disponib nan espas pèsonèl ou.'],
 contact:['Nouveau message de contact','Nouvo mesaj kontak','Une demande a été enregistrée. Consultez la messagerie de support.','Yon demann anrejistre. Gade mesaj sipò yo.'],
 escalation:['Un étudiant attend votre réponse','Yon etidyan ap tann repons ou','Une question vous a été transférée.','Yon kesyon transfere ba ou.'],
 test:['Test email Faro School','Tès imèl Faro School','Ceci est un test demandé par un administrateur connecté.','Sa a se yon tès yon administratè konekte mande.'],
 };
 const t=texts[input.kind];if(!t)throw new Error('unknown_email_template');
 const subject=t[h?1:0]+' — Faro School',paragraphs=[t[h?3:2],input.name,input.course,input.amount,input.detail].filter(Boolean) as string[];
 const safeUrl=(url:string)=>{const u=new URL(url);if(!['http:','https:'].includes(u.protocol))throw new Error('invalid_email_link');return escapeHtml(url);};
 const text=[subject,...paragraphs,input.code,input.url,input.receiptUrl,h?'Si se pa ou ki mande sa, kontakte sipò.':'Si vous n’êtes pas à l’origine de cette demande, contactez le support.'].filter(Boolean).join('\n\n');
 const html=`<!doctype html><html lang="${h?'ht':'fr'}"><meta charset="utf-8"><body style="margin:0;background:#f7f9fc;padding:32px 16px;font-family:Arial,sans-serif;color:#031047"><main style="max-width:520px;margin:auto;background:white;border:1px solid #e2e8f0;border-radius:16px;padding:32px"><h2>Faro School</h2><h1 style="font-size:22px">${escapeHtml(t[h?1:0])}</h1>${paragraphs.map(p=>`<p style="line-height:1.6">${escapeHtml(p)}</p>`).join('')}${input.code?`<p style="font-size:36px;letter-spacing:8px;font-weight:bold;text-align:center;color:#ff7f0e">${escapeHtml(input.code)}</p>`:''}${input.url?`<p><a style="display:inline-block;padding:14px 24px;background:#031047;color:white;border-radius:10px;text-decoration:none" href="${safeUrl(input.url)}">${h?'Kontinye':'Continuer'}</a></p>`:''}${input.receiptUrl?`<p><a href="${safeUrl(input.receiptUrl)}">${h?'Resi mwen':'Mon reçu'}</a></p>`:''}<p style="font-size:12px;color:#5b6478">${h?'Pa pataje kòd oswa lyen sekirite ou.':'Ne partagez jamais votre code ou votre lien de sécurité.'}</p></main></body></html>`;
 return{subject,html,text};
}
