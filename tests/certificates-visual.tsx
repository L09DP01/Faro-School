// Test-only harness renders the actual production components. Never imported by the app.
import React from "react";
import { createRoot } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import fr from "../src/messages/fr.json";
import ht from "../src/messages/ht.json";
import { StudentDashboardShell } from "../src/components/dashboard/StudentDashboardShell";
import { AdminLayoutClient } from "../src/components/admin/AdminLayoutClient";
import { CertificatePreview } from "../src/components/certificates/CertificatePreview";
import { StudentCertificates,CertificateCelebration,NameConfirmation } from "../src/components/certificates/StudentCertificates";
import { AdminCertificates,SAMPLE_CERTIFICATE } from "../src/components/certificates/AdminCertificates";
import { VerificationView } from "../src/components/certificates/VerificationView";
import { verificationUrl } from "../src/lib/certificates/shared";
const search=new URLSearchParams(location.search),view=search.get("view")??"student",locale=search.get("locale")??"fr";
const cert={...SAMPLE_CERTIFICATE,id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",user_id:"11111111-1111-4111-8111-111111111111",course_id:"55555555-5555-4555-8555-555555555555",signature_name:"Élodie Paul",signature_title:"Direction pédagogique",courses:{slug:"marketing-digital",cover_url:"/brand/hero.webp"}};
const certificateUrl=verificationUrl(location.origin,cert.certificate_number);
const originalFetch=window.fetch;
window.fetch=async(input,init)=>{
 const url=String(input);
 if(url==="/api/certificates")return Response.json({certificates:[cert],available:[],fullName:cert.student_name});
 if(url==="/api/admin/certificates")return Response.json({certificates:[cert,{...cert,id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",certificate_number:"FARO-2026-8M3N7P2B",student_name:"D'Haiti",course_title:"Excel et gestion d’entreprise",revoked_at:"2026-10-29T12:00:00Z"}],settings:{signature_name:cert.signature_name,signature_title:cert.signature_title,signature_image_path:null},canManage:true});
 return originalFetch(input,init);
};
function Harness(){
 let content:React.ReactNode;
 if(view==="preview")content=<div className="max-w-5xl mx-auto p-4 md:p-8"><CertificatePreview certificate={cert} url={certificateUrl}/></div>;
 else if(view==="celebration")content=<div className="max-w-lg mx-auto p-4 pt-20"><CertificateCelebration onGet={()=>{location.search="?view=confirm";}}/></div>;
 else if(view==="confirm")content=<NameConfirmation initialName={cert.student_name} onConfirm={()=>{}} onClose={()=>{}}/>;
 else if(view.startsWith("verification-")){const state=view.replace("verification-","");content=<VerificationView locale={locale} result={state==="valid"?{status:"valid",student_name:cert.student_name,course_title:cert.course_title,issued_at:cert.issued_at,instructor_name:cert.instructor_name}:state==="revoked"?{status:"revoked",revoked_at:"2026-10-29T12:00:00Z"}:{status:"not_found"}}/>;}
 else if(view==="admin")content=<AdminLayoutClient admin={{id:cert.user_id,email:"admin@example.test",fullName:"Administration Faro",role:"admin",phone:null,locale:"fr",emailVerified:"2026-10-29",tokenVersion:0}} locale={locale}><AdminCertificates locale={locale} baseUrl={location.origin}/></AdminLayoutClient>;
 else content=<StudentDashboardShell user={{fullName:cert.student_name,email:"student@example.test",role:"student"}} locale={locale}><StudentCertificates locale={locale} initialCertificates={[cert]} initialName={cert.student_name} baseUrl={location.origin}/></StudentDashboardShell>;
 return <NextIntlClientProvider locale={locale} messages={locale==="ht"?ht:fr}>{content}</NextIntlClientProvider>;
}
createRoot(document.getElementById("root")!).render(<Harness/>);
