import {sha256} from "@/lib/webhooks/security";
import {processOutbox} from "@/lib/email/outbox";
import { NextRequest, NextResponse } from "next/server";
import { resetPasswordSchema } from "@/lib/validators/auth";
import { isCommonPassword } from "@/lib/auth/rate-limit";
import { hashPassword } from "@/lib/auth/password";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token as string;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Jeton de réinitialisation manquant." }, { status: 400 });
    }

    const result = resetPasswordSchema.safeParse({ password: body.password });
    if (!result.success) {
      return NextResponse.json(
        {
          error:
            "Le mot de passe doit comporter au moins 10 caractères avec majuscule, minuscule et chiffre.",
        },
        { status: 400 }
      );
    }

    const { password } = result.data;
    if (isCommonPassword(password)) {
      return NextResponse.json(
        { error: "Ce mot de passe est trop facile à deviner. Choisissez un mot de passe plus robuste." },
        { status: 400 }
      );
    }

    const passwordHash=await hashPassword(password);
    const{data,error}=await getAdminSupabase().rpc('reset_password_atomic',{p_hash:await sha256(token),p_password_hash:passwordHash});
    if(error)return NextResponse.json({error:'unavailable'},{status:503});
    if(!data?.success)return NextResponse.json({error:'invalid_or_expired'},{status:400});
    // The credential trigger queues the security warning in the same transaction.
    await processOutbox().catch(()=>console.error('[email] security_notification_pending'));
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[auth] reset_unavailable");
    return NextResponse.json({ error: "Erreur serveur lors de la réinitialisation." }, { status: 500 });
  }
}
