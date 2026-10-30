import {notFound} from 'next/navigation';
import {emailAdmin,emailHealth} from '@/lib/email/admin';
import {EmailAdminPanel} from '@/components/admin/EmailAdminPanel';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{locale:string}>}){try{await emailAdmin();}catch{notFound();}const{locale}=await params;return <EmailAdminPanel locale={locale} initial={await emailHealth()}/>;}
