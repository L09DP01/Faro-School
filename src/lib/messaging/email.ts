interface SendEscalationEmailParams {
  toEmail: string;
  studentName: string;
  courseTitle: string;
  subject: string;
  question: string;
  conversationId: string;
  locale?: string;
  recentMessagesSnippet?: string;
}

export async function sendEscalationEmail({
  toEmail,
  studentName,
  courseTitle,
  subject,
  question,
  conversationId,
  locale = "fr",
  recentMessagesSnippet,
}: SendEscalationEmailParams): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "Faro School <notifications@faroschool.com>";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const conversationUrl = `${baseUrl}/${locale}/admin/messages/${conversationId}`;

  const isHt = locale === "ht";
  const emailSubject = isHt
    ? `[Faro School] Nouvo kesyon etidyan: ${studentName} (${courseTitle})`
    : `[Faro School] Nouvelle question étudiant : ${studentName} (${courseTitle})`;

  const html = `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <title>${emailSubject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px; color: #101828; }
    .card { max-width: 600px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 12px rgba(16, 24, 40, 0.05); }
    .header { text-align: center; margin-bottom: 24px; }
    .badge { display: inline-block; padding: 4px 12px; background: #FFF5EB; color: #FF7F0E; border-radius: 9999px; font-size: 12px; font-weight: bold; margin-bottom: 8px; }
    h1 { font-size: 20px; font-weight: 700; margin: 8px 0; color: #031047; }
    .meta-box { background: #F8FAFC; border-left: 4px solid #FF7F0E; padding: 12px 16px; border-radius: 8px; margin: 16px 0; font-size: 14px; }
    .question-box { background: #EFF4FE; border: 1px solid #D1E0FE; border-radius: 12px; padding: 16px; margin: 16px 0; font-size: 14px; line-height: 1.6; }
    .btn { display: inline-block; background: #FF7F0E; color: #FFFFFF !important; text-decoration: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; font-size: 14px; margin-top: 16px; text-align: center; }
    .footer { font-size: 12px; color: #5B6478; text-align: center; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="badge">${isHt ? "Notifikasyon Formateur" : "Escalade Formateur"}</div>
      <h1>${isHt ? "Yon etidyan bezwen èd ou" : "Un étudiant a besoin de votre réponse"}</h1>
    </div>

    <div class="meta-box">
      <strong>${isHt ? "Etidyan" : "Étudiant"} :</strong> ${studentName}<br>
      <strong>${isHt ? "Fòmasyon" : "Formation"} :</strong> ${courseTitle}<br>
      <strong>${isHt ? "Sijè" : "Sujet"} :</strong> ${subject}
    </div>

    <div class="question-box">
      <strong>${isHt ? "Mesaj etidyan an" : "Message de l'étudiant"} :</strong><br>
      <p style="margin: 8px 0 0 0; white-space: pre-wrap;">${question}</p>
    </div>

    ${
      recentMessagesSnippet
        ? `<div style="font-size: 12px; color: #5B6478; margin-top: 12px;">
            <strong>${isHt ? "Dènye echanj yo" : "Historique récent"} :</strong><br>
            <pre style="background: #F8FAFC; padding: 8px; border-radius: 6px; white-space: pre-wrap; font-family: inherit;">${recentMessagesSnippet}</pre>
           </div>`
        : ""
    }

    <div style="text-align: center; margin-top: 24px;">
      <a href="${conversationUrl}" class="btn">
        ${isHt ? "Reponn etidyan an kounye a" : "Répondre à l'étudiant"}
      </a>
    </div>

    <div class="footer">
      <p>${isHt ? "Règ 2 minit la aktif : si ou pa reponn nan 2 minit, yon mesaj ap enfòme etidyan an pou l retounen pita." : "Règle des 2 minutes active : si vous n'êtes pas en ligne, un message d'attente informera l'étudiant."}</p>
      <p>Faro School — Plateforme d'apprentissage en ligne pour Haïti.</p>
    </div>
  </div>
</body>
</html>
  `;

  if (!apiKey) {
    console.info(`[EMAIL SIMULATION] RESEND_API_KEY not configured. Escalation email simulated for ${toEmail}: ${emailSubject}`);
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
        from,
        to: [toEmail],
        subject: emailSubject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[RESEND ERROR]", errText);
      return { success: false, error: errText };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[RESEND FETCH ERROR]", err);
    return { success: false, error: err.message };
  }
}
