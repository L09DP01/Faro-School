import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { StudentDashboardShell } from "@/components/dashboard/StudentDashboardShell";
import { StudentCertificates } from "@/components/certificates/StudentCertificates";
export const metadata={robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{locale:string}>}){
 const {locale}=await params;setRequestLocale(locale);const user=await getCurrentUser();
 if(!user?.emailVerified)redirect(`/${locale}/connexion?next=/${locale}/certificats`);
 return <StudentDashboardShell user={user} locale={locale}><StudentCertificates locale={locale} initialName={user.fullName} baseUrl={process.env.NEXT_PUBLIC_APP_URL??""} signatureHost={process.env.BUNNY_STORAGE_CDN_HOSTNAME}/></StudentDashboardShell>;
}
