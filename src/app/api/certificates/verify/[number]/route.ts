import { verifyPublicCertificate } from "@/lib/certificates/verify";
export const dynamic="force-dynamic";
export async function GET(req:Request,{params}:{params:Promise<{number:string}>}) {
 const headers={"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"};
 try {const {number}=await params;return Response.json(await verifyPublicCertificate(number,req.headers.get("cf-connecting-ip")??req.headers.get("x-forwarded-for")?.split(",")[0]??"unknown"),{headers});}
 catch(e){const limited=e instanceof Error&&e.message==="rate_limit";return Response.json({error:limited?"rate_limit":"unavailable"},{status:limited?429:503,headers:{...headers,...(limited?{"Retry-After":"60"}:{})}});}
}
