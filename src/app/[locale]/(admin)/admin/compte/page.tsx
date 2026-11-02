import {requireStaff} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {ProfileForm} from '@/components/dashboard/ProfileForm';
import {PublicAuthorProfile} from '@/components/admin/instructors/PublicAuthorProfile';
export default async function AccountPage({params}:{params:Promise<{locale:string}>}){
 const {locale}=await params,user=await requireStaff(locale),ht=locale==='ht',db=await createClient();
 const [profile,author]=await Promise.all([db.from('profiles').select('avatar_url').eq('id',user.id).single(),db.from('instructors').select('title,bio').eq('profile_id',user.id).maybeSingle()]);
 return <div className="space-y-6"><h1 className="font-heading text-2xl font-bold text-navy-deep">{ht?'Kont mwen':'Mon compte'}</h1>
 <ProfileForm user={user} currentLocale={locale} section="profile"/>
 <PublicAuthorProfile locale={locale} available={!profile.error&&!author.error} initial={{fullName:user.fullName,avatarUrl:profile.data?.avatar_url||'',title:author.data?.title||'',bio:author.data?.bio||''}}/>
 <ProfileForm user={user} currentLocale={locale} section="settings"/></div>;
}
