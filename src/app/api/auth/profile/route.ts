import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { validateAndFormatHaitianPhone, passwordStrengthSchema } from "@/lib/validators/auth";
import { isCommonPassword } from "@/lib/auth/rate-limit";
import { hashPassword } from "@/lib/auth/password";

export const runtime = "edge";

const updateProfileSchema = z.object({
  fullName: z.string().min(2, "Le nom doit comporter au moins 2 caractères").optional(),
  phone: z.string().optional(),
  locale: z.enum(["fr", "ht"]).optional(),
  newPassword: z.string().optional().or(z.literal("")),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const result = updateProfileSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Données invalides", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { fullName, phone, locale, newPassword } = result.data;
    const supabase = await createClient();

    // 1. Format phone if provided
    let formattedPhone: string | null = null;
    if (phone && phone.trim().length > 0) {
      const phoneValidation = validateAndFormatHaitianPhone(phone);
      if (!phoneValidation.isValid) {
        return NextResponse.json(
          { error: "Numéro de téléphone haïtien invalide (+509 36123456)" },
          { status: 400 }
        );
      }
      formattedPhone = phoneValidation.formatted;
    }

    // 2. Update profile table
    const updateData: Record<string, any> = {};
    if (fullName) updateData.full_name = fullName.trim();
    if (formattedPhone !== null) updateData.phone = formattedPhone;
    if (locale) updateData.locale = locale;

    if (Object.keys(updateData).length > 0) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user.id);

      if (profileError) {
        return NextResponse.json(
          { error: "Erreur lors de la mise à jour du profil", details: profileError.message },
          { status: 500 }
        );
      }
    }

    // 3. Update password if requested
    if (newPassword && newPassword.trim().length > 0) {
      const pwCheck = passwordStrengthSchema.safeParse(newPassword);
      if (!pwCheck.success) {
        return NextResponse.json(
          {
            error:
              "Le nouveau mot de passe doit comporter au moins 10 caractères avec une majuscule, une minuscule et un chiffre.",
          },
          { status: 400 }
        );
      }

      if (isCommonPassword(newPassword)) {
        return NextResponse.json(
          { error: "Ce mot de passe est trop facile à deviner. Choisissez un mot de passe plus robuste." },
          { status: 400 }
        );
      }

      const adminSupabase = getAdminSupabase();
      const passwordHash = await hashPassword(newPassword);

      // Fetch current token_version
      const { data: creds } = await adminSupabase
        .from("user_credentials")
        .select("token_version")
        .eq("user_id", user.id)
        .single();

      const nextTokenVersion = (creds?.token_version ?? 0) + 1;

      const { error: credsError } = await adminSupabase
        .from("user_credentials")
        .update({
          password_hash: passwordHash,
          token_version: nextTokenVersion,
        })
        .eq("user_id", user.id);

      if (credsError) {
        return NextResponse.json(
          { error: "Erreur lors de la modification du mot de passe", details: credsError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Profil mis à jour avec succès",
      updated: updateData,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Erreur serveur", message: err?.message },
      { status: 500 }
    );
  }
}
