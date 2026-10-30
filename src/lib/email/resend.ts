import {enqueueEmail} from './outbox';
import type {EmailMessage} from './transport';
import type {EmailResult} from './result';
/** Business content only. Auth messages must use queueAuthEmail, never persist codes or links. */
export async function sendEmail(message:EmailMessage):Promise<EmailResult>{return enqueueEmail({kind:'custom',to:message.to,key:message.idempotencyKey??'custom:'+crypto.randomUUID(),data:{subject:message.subject,html:message.html,text:message.text??message.html.replace(/<[^>]*>/g,' ')}});}
