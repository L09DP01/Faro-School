import { requireRole } from "@/lib/permissions";
import { AdminCertificates } from "@/components/certificates/AdminCertificates";
export const metadata={robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{locale:string}>}){
 const {locale}=await params;await requireRole(["admin","instructor"],locale);
 return <AdminCertificates locale={locale} baseUrl={process.env.NEXT_PUBLIC_APP_URL??""} signatureHost={process.env.BUNNY_STORAGE_CDN_HOSTNAME}/>;
}
