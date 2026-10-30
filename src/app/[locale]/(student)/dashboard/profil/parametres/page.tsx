import {getCurrentUser} from "@/lib/auth";
import {getTranslations} from "next-intl/server";
import {ProfileForm} from "@/components/dashboard/ProfileForm";
import {Link} from "@/i18n/navigation";
import type {Metadata} from "next";
export async function generateMetadata({params}:{params:Promise<{locale:string}>}):Promise<Metadata>{
 const {locale}=await params;const t=await getTranslations({locale,namespace:"dashboard.profile"});
 return {title:`${t("settingsTitle")} | Faro School`,robots:{index:false,follow:false}};
}
export default async function StudentSettingsPage({params}:{params:Promise<{locale:string}>}){
 const {locale}=await params;const user=await getCurrentUser();const t=await getTranslations({locale,namespace:"dashboard.profile"});
 if(!user)return null;
 return <div className="max-w-4xl space-y-6"><div><h1 className="font-heading text-xl font-bold text-ink sm:text-2xl">{t("settingsTitle")}</h1><p className="mt-1 text-sm text-muted-faro">{t("settingsSubtitle")}</p></div><Link href="/dashboard/profil" className="inline-flex min-h-11 items-center text-sm font-semibold text-orange">{t("backToProfile")}</Link><ProfileForm user={user} currentLocale={locale} section="settings"/></div>;
}
