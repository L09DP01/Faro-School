import {VerificationLink} from '@/components/auth/VerificationLink';
export const metadata={robots:{index:false,follow:false},referrer:'no-referrer' as const};
export default async function Page({params}:{params:Promise<{locale:string}>}){const{locale}=await params;return <VerificationLink locale={locale}/>;}
