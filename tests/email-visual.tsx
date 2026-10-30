// Local visual fixtures of production components. Never bundled into the application.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {NextIntlClientProvider} from 'next-intl';
import {EmailAdminPanel} from '../src/components/admin/EmailAdminPanel';
import {VerificationLink} from '../src/components/auth/VerificationLink';
import {VerificationCodeForm} from '../src/components/auth/VerificationCodeForm';
import {renderEmail} from '../src/lib/email/templates';
import fr from '../src/messages/fr.json';
import ht from '../src/messages/ht.json';
const query=new URLSearchParams(location.search),view=query.get('view')??'admin',locale=query.get('locale')??'fr',state=query.get('state')??'valid';
window.fetch=async()=>Response.json(state==='valid'?{success:true}:{reason:state},{status:state==='valid'?200:400});
const initial:any={health:{key:true,sender:true,suppressions:true,outbox:true,webhook:true,lastSuccess:'2026-10-30 10:00 UTC',lastFailure:'provider_rate_limited'},counts:{accepted:18,delivered:15,failed_temporary:1},failures:[{id:'fixture',kind:'verification',recipient:'j***@gmail.com',status:'failed_temporary',attempts:2,last_error_category:'provider_rate_limited',provider_http_status:429,correlation_id:'00000000-0000-4000-8000-000000000000',updated_at:'2026-10-30 10:04 UTC'}],tracking:[]};
if(state==='failed'){initial.health.key=false;initial.health.suppressions=false;initial.health.outbox=false;initial.health.lastFailure='config_missing';}
const container='mx-auto max-w-6xl p-6';
let page:React.ReactNode=view==='admin'?<div className={container}><EmailAdminPanel locale={locale} initial={initial}/></div>:view==='code'?<div className="mx-auto max-w-md rounded-2xl border border-line bg-surface p-6"><VerificationCodeForm email="visual@example.test"/></div>:view==='email'?<div dangerouslySetInnerHTML={{__html:renderEmail({kind:query.get('kind')??'verification',locale,code:query.get('kind')==='verification'?'••••••':undefined,name:query.get('kind')==='invitation'?'Jan-Pòl Étienne':undefined,course:query.get('kind')==='payment_confirmed'?'Marketing digital et entrepreneuriat':undefined,amount:query.get('kind')==='payment_confirmed'?'1 250 HTG':undefined,url:'https://example.test/lien-masque'}).html}}/>:<div className="mx-auto max-w-md pt-16"><VerificationLink locale={locale}/></div>;
createRoot(document.getElementById('root')!).render(<NextIntlClientProvider locale={locale} messages={locale==='ht'?ht:fr}>{page}</NextIntlClientProvider>);
