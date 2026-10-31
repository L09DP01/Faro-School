import {requireStaff} from '@/lib/auth';
import {ProfileForm} from '@/components/dashboard/ProfileForm';
export default async function AccountPage({params}:{params:Promise<{locale:string}>}){const {locale}=await params,user=await requireStaff(locale),ht=locale==='ht';return <div className="space-y-6"><h1 className="font-heading text-2xl font-bold text-navy-deep">{ht?'Kont mwen':'Mon compte'}</h1><ProfileForm user={user} currentLocale={locale} section="profile"/><ProfileForm user={user} currentLocale={locale} section="settings"/></div>;}
