/**
 * Edge-compatible Email Dispatch via Resend API (fetch-based).
 * Supports French (FR) and Haitian Creole (KR/HT).
 */

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || "Faro School <contact@faroschool.com>";

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Email] RESEND_API_KEY is missing in production. Delivery rejected.");
      return { success: false, error: "Configuration email manquante en production" };
    }
    console.log(`[Email Mock (Dev)] To: ${to} | Subject: ${subject}`);
    return { success: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Resend API Error]:", errText);
      return { success: false, error: errText };
    }

    return { success: true };
  } catch (err) {
    console.error("[Email] Failed to send email:", err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * 1. Verification code email (FR and KR)
 */
export async function sendVerificationEmail(
  to: string,
  code: string,
  verifyUrl: string,
  locale: string = "fr"
) {
  const isHt = locale === "ht";
  const subject = isHt
    ? `Kòd verifikasyon Faro School ou a : ${code}`
    : `Votre code de vérification Faro School : ${code}`;

  const html = `
<!DOCTYPE html>
<html lang="${locale}">
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f7f9fc; padding: 32px 16px; margin: 0; color: #1a202c;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0;">
    <h2 style="color: #031047; margin-top: 0; font-size: 22px;">Faro School</h2>
    <p style="font-size: 15px; line-height: 1.5; color: #4a5568;">
      ${
        isHt
          ? "Mèsi paske w chwazi Faro School ! Men kòd sekirite pou w konfime imèl ou :"
          : "Bienvenue sur Faro School ! Voici votre code de vérification pour activer votre compte :"
      }
    </p>
    <div style="background-color: #f1f5f9; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
      <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #ff7f0e; font-family: monospace;">${code}</span>
    </div>
    <p style="font-size: 13px; color: #718096; line-height: 1.5;">
      ${
        isHt
          ? "Kòd sa a valab pou 10 minit sèlman. Si se pa ou menm ki te mande l, ou mèt inyore mesaj sa a."
          : "Ce code est valide pendant 10 minutes. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail."
      }
    </p>
    <div style="margin-top: 24px; text-align: center;">
      <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #031047; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px;">
        ${isHt ? "Konfime imèl mwen" : "Confirmer mon adresse e-mail"}
      </a>
    </div>
  </div>
</body>
</html>
`;

  return sendEmail({ to, subject, html });
}

/**
 * 2. Password reset email (FR and KR)
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
  locale: string = "fr"
) {
  const isHt = locale === "ht";
  const subject = isHt
    ? "Reyinisyalize modpas Faro School ou a"
    : "Réinitialisation de votre mot de passe Faro School";

  const html = `
<!DOCTYPE html>
<html lang="${locale}">
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f7f9fc; padding: 32px 16px; margin: 0; color: #1a202c;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0;">
    <h2 style="color: #031047; margin-top: 0; font-size: 22px;">Faro School</h2>
    <p style="font-size: 15px; line-height: 1.5; color: #4a5568;">
      ${
        isHt
          ? "Nou resevwa yon demann pou chanje modpas kont ou a. Klike sou bouton ki anba a pou w chwazi yon nouvo modpas :"
          : "Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le lien ci-dessous pour en créer un nouveau :"
      }
    </p>
    <div style="margin: 28px 0; text-align: center;">
      <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; background-color: #ff7f0e; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 15px;">
        ${isHt ? "Chanje modpas mwen" : "Réinitialiser mon mot de passe"}
      </a>
    </div>
    <p style="font-size: 13px; color: #718096; line-height: 1.5;">
      ${
        isHt
          ? "Lyen sa a ap ekspire nan 1 èdtan. Si se pa ou ki te fè demann lan, pa gen okenn aksyon ki nesesè, modpas ou a rete an sekirite."
          : "Ce lien est valide pendant 1 heure. Si vous n'avez pas demandé cette réinitialisation, votre compte reste sécurisé et vous pouvez ignorer cet e-mail."
      }
    </p>
  </div>
</body>
</html>
`;

  return sendEmail({ to, subject, html });
}

/**
 * 3. Security alert for attempted registration with already verified email
 */
export async function sendExistingAccountAlertEmail(
  to: string,
  locale: string = "fr"
) {
  const isHt = locale === "ht";
  const subject = isHt
    ? "Alèt sekirite : tantativ enskripsyon sou kont Faro School ou"
    : "Alerte de sécurité : tentative d'inscription avec votre adresse";

  const html = `
<!DOCTYPE html>
<html lang="${locale}">
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f7f9fc; padding: 32px 16px; margin: 0; color: #1a202c;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0;">
    <h2 style="color: #031047; margin-top: 0; font-size: 22px;">Faro School</h2>
    <p style="font-size: 15px; line-height: 1.5; color: #4a5568;">
      ${
        isHt
          ? "Yon moun te eseye kreye yon nouvo kont ak adrès imèl sa a sou Faro School. Kòm kont ou a deja anrejistre epi verifye, okenn lòt kont pa te kreye."
          : "Quelqu'un a tenté de créer un compte avec votre adresse e-mail sur Faro School. Votre compte étant déjà actif et protégé, aucune action n'a été autorisée."
      }
    </p>
    <p style="font-size: 14px; color: #718096; line-height: 1.5;">
      ${
        isHt
          ? "Si se ou menm ki t ap eseye konekte, ou ka senpleman konekte ak modpas ou oswa itilize opsyon modpas bliye."
          : "Si vous êtes à l'origine de cette tentative, vous pouvez simplement vous connecter ou demander une réinitialisation de votre mot de passe."
      }
    </p>
  </div>
</body>
</html>
`;

  return sendEmail({ to, subject, html });
}

export const sendSecurityAlertEmail = (to: string, _resetUrl: string, locale: string = "fr") =>
  sendExistingAccountAlertEmail(to, locale);

/**
 * 4. Instructor invitation email with set-password link
 */
export async function sendInstructorInvitationEmail(
  to: string,
  invitationUrl: string,
  fullName: string,
  locale: string = "fr"
) {
  const isHt = locale === "ht";
  const subject = isHt
    ? "Envitasyon pou vin fòmatè sou Faro School"
    : "Invitation à rejoindre l'équipe pédagogique de Faro School";

  const html = `
<!DOCTYPE html>
<html lang="${locale}">
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f7f9fc; padding: 32px 16px; margin: 0; color: #1a202c;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0;">
    <h2 style="color: #031047; margin-top: 0; font-size: 22px;">Faro School</h2>
    <p style="font-size: 15px; line-height: 1.5; color: #4a5568;">
      ${
        isHt
          ? `Bonjou ${fullName}, yon administratè envite w kòm fòmatè sou platfòm Faro School.`
          : `Bonjour ${fullName}, un administrateur vous a invité en tant que formateur sur Faro School.`
      }
    </p>
    <p style="font-size: 15px; line-height: 1.5; color: #4a5568;">
      ${
        isHt
          ? "Klike sou lyen ki anba a pou w kreye modpas ou epi aktive espas fòmatè w la :"
          : "Veuillez cliquer sur le bouton ci-dessous pour définir votre mot de passe et activer votre compte :"
      }
    </p>
    <div style="margin: 28px 0; text-align: center;">
      <a href="${invitationUrl}" style="display: inline-block; padding: 14px 28px; background-color: #031047; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 15px;">
        ${isHt ? "Aktive kont fòmatè mwen" : "Activer mon compte formateur"}
      </a>
    </div>
    <p style="font-size: 13px; color: #718096; line-height: 1.5;">
      ${
        isHt
          ? "Lyen envitasyon sa a valab pandan 72 èdtan."
          : "Ce lien d'invitation est valide pendant 72 heures."
      }
    </p>
  </div>
</body>
</html>
`;

  return sendEmail({ to, subject, html });
}
