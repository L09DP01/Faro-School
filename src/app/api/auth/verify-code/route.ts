import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyEmailCode, verifyEmailLinkToken } from "@/lib/auth/tokens";
import { normalizeEmail } from "@/lib/auth/rate-limit";

export const runtime = "nodejs";

const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

const verifyTokenSchema = z.object({
  token: z.string().min(10),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Support both 6-digit code and direct link token
    if (body.token) {
      const parsed = verifyTokenSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Jeton de vérification invalide." }, { status: 400 });
      }

      const result = await verifyEmailLinkToken(parsed.data.token);
      if (!result.success) {
        let msg = "Code de vérification invalide.";
        if (result.reason === "expired") msg = "Ce code a expiré. Veuillez en demander un nouveau.";
        if (result.reason === "already_used") msg = "Cet e-mail a déjà été vérifié. Vous pouvez vous connecter.";
        return NextResponse.json({ error: msg, reason: result.reason }, { status: 400 });
      }

      return NextResponse.json({ success: true, verified: true, email: result.email });
    }

    const parsed = verifyCodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Veuillez fournir un code à 6 chiffres valide." },
        { status: 400 }
      );
    }

    const normEmail = normalizeEmail(parsed.data.email);
    const result = await verifyEmailCode(normEmail, parsed.data.code);

    if (!result.success) {
      let msg = "Code incorrect. Veuillez vérifier et réessayer.";
      if (result.reason === "expired") {
        msg = "Ce code a expiré (durée de validité : 10 minutes). Veuillez en demander un nouveau.";
      } else if (result.reason === "max_attempts") {
        msg = "Nombre maximal de tentatives atteint (5 essais). Veuillez demander un nouveau code.";
      } else if (result.reason === "already_used") {
        msg = "Votre e-mail est déjà vérifié. Vous pouvez vous connecter.";
      }
      return NextResponse.json({ error: msg, reason: result.reason }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      verified: true,
      email: result.email,
    });
  } catch (err: any) {
    console.error("Verify code error:", err);
    return NextResponse.json({ error: "Erreur serveur lors de la vérification." }, { status: 500 });
  }
}
