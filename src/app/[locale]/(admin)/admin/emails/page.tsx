import {notFound,unstable_rethrow} from 'next/navigation';
import {emailAdmin,emailHealth} from '@/lib/email/admin';
import {EmailAdminPanel} from '@/components/admin/EmailAdminPanel';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{locale:string}>}){try{await emailAdmin();}catch(error){unstable_rethrow(error);notFound();}const{locale}=await params;return <EmailAdminPanel locale={locale} initial={await emailHealth()}/>;}
