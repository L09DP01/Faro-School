import {enqueueEmail,queueAuthEmail} from './outbox';
import type {EmailMessage} from './transport';
import type {EmailResult} from './result';
/** Business content only. Auth messages must use queueAuthEmail, never persist codes or links. */
export async function sendEmail(message:EmailMessage):Promise<EmailResult>{return enqueueEmail({kind:'custom',to:message.to,key:message.idempotencyKey??'custom:'+crypto.randomUUID(),data:{subject:message.subject,html:message.html,text:message.text??message.html.replace(/<[^>]*>/g,' ')}});}
export const sendVerificationEmail=(to:string,_code:string,_url:string,locale='fr')=>queueAuthEmail(to,'verification',locale);
export const sendPasswordResetEmail=(to:string,_url:string,locale='fr')=>queueAuthEmail(to,'reset',locale);
export const sendExistingAccountAlertEmail=(to:string,locale='fr')=>queueAuthEmail(to,'registration_alert',locale);
export const sendSecurityAlertEmail=(to:string,_url:string,locale='fr')=>queueAuthEmail(to,'registration_alert',locale);
export const sendInstructorInvitationEmail=(to:string,_url:string,_name:string,locale='fr')=>queueAuthEmail(to,'invitation',locale);
