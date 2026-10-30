import { headers } from "next/headers";
import { VerificationView } from "@/components/certificates/VerificationView";
import { verifyPublicCertificate } from "@/lib/certificates/verify";
import { getTranslations } from "next-intl/server";
export const dynamic="force-dynamic";
export const metadata={robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{locale:string;certificateNumber:string}>}){
 const {locale,certificateNumber}=await params;const h=await headers();const t=await getTranslations({locale,namespace:"certificates"});
 try {const result=await verifyPublicCertificate(certificateNumber,h.get("cf-connecting-ip")??h.get("x-forwarded-for")?.split(",")[0]??"unknown");return <VerificationView result={result} locale={locale}/>;}
 catch(e){return <main className="max-w-xl mx-auto px-4 py-20 text-navy-deep" role="status">{t(e instanceof Error&&e.message==="rate_limit"?"rate_limit":"unavailable")}</main>;}
}
