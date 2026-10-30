import { redirect } from 'next/navigation';
export const metadata={robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{locale:string;code:string}>}) {const {locale,code}=await params;redirect('/'+locale+'/verification/'+encodeURIComponent(code));}
