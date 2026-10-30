import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { eligibility } from "@/lib/certificates/service";
export async function CertificateCourseBadge({courseId,locale}:{courseId:string;locale:string}) {
 const user=await getCurrentUser();if(!user?.emailVerified)return null;
 try{const result=await eligibility(user.id,courseId);const obtained=result.certificate&&!result.certificate.revoked_at;
 const available=result.eligible&&(!result.certificate||result.certificate.revoked_reason==="legacy_unconfirmed");
 if(!obtained&&!available)return null;
 const t=await getTranslations({locale,namespace:"certificates"});
 return <a href={`/${locale}/certificats`} className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-orange-tint text-navy-deep">{t(obtained?"obtained":"available")}</a>;
 }catch{return null;}
}
