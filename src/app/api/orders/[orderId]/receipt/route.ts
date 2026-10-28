import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

function sanitizePdfText(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E]/g, " ")
    .trim();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    // 1. Guard: Authentication check
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Non autorise" },
        { status: 401 }
      );
    }

    // 2. Fetch order from database
    const supabase = await createClient();
    const { data: order, error } = await supabase
      .from("orders")
      .select(`
        id,
        reference,
        amount_htg,
        status,
        user_id,
        created_at,
        courses (
          title_fr,
          title_ht
        ),
        payments (
          provider,
          provider_txn_id,
          status,
          created_at
        )
      `)
      .eq("id", orderId)
      .maybeSingle();

    // Guard: Order must belong to current user
    if (error || !order || order.user_id !== user.id) {
      return NextResponse.json(
        { error: "Commande introuvable" },
        { status: 404 }
      );
    }

    const courseData = order.courses as { title_fr?: string; title_ht?: string } | null;
    const courseTitle = courseData?.title_fr || "Formation en ligne";

    const paymentsList = Array.isArray(order.payments) ? order.payments : [];
    const latestPayment = paymentsList.length > 0 ? paymentsList[paymentsList.length - 1] : null;
    const paymentMethod = latestPayment?.provider?.toUpperCase() || "MONCASH";
    const paymentRef = latestPayment?.provider_txn_id || order.reference;

    const formattedDate = new Date(order.created_at).toLocaleDateString("fr-HT", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // 3. Generate PDF receipt using pdf-lib
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 (points)
    const { width, height } = page.getSize();

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Color definitions
    const primaryColor = rgb(0.09, 0.12, 0.17); // #171e2b
    const accentColor = rgb(0.2, 0.25, 0.35);
    const mutedColor = rgb(0.45, 0.5, 0.58);
    const borderColor = rgb(0.85, 0.88, 0.92);
    const bgColor = rgb(0.97, 0.98, 0.99);

    let y = height - 50;

    // Header: Company Logo / Title
    page.drawText(sanitizePdfText("FARO SCHOOL"), {
      x: 50,
      y,
      size: 22,
      font: fontBold,
      color: primaryColor,
    });

    page.drawText(sanitizePdfText("RECU DE PAIEMENT OFFICIEL"), {
      x: width - 240,
      y: y + 2,
      size: 11,
      font: fontBold,
      color: accentColor,
    });

    y -= 18;
    page.drawText(sanitizePdfText("Plateforme de formation professionnelle pour Haiti"), {
      x: 50,
      y,
      size: 9,
      font: fontRegular,
      color: mutedColor,
    });

    page.drawText(sanitizePdfText(`Recu #: ${order.reference}`), {
      x: width - 240,
      y,
      size: 9,
      font: fontRegular,
      color: mutedColor,
    });

    // Separator
    y -= 25;
    page.drawLine({
      start: { x: 50, y },
      end: { x: width - 50, y },
      thickness: 1,
      color: borderColor,
    });

    // Info Grid: Student & Order Info
    y -= 35;
    const leftCol = 50;
    const rightCol = 320;

    // Left Column: Customer details
    page.drawText(sanitizePdfText("FACTURE A :"), {
      x: leftCol,
      y,
      size: 9,
      font: fontBold,
      color: mutedColor,
    });

    page.drawText(sanitizePdfText("DETAILS DE LA COMMANDE :"), {
      x: rightCol,
      y,
      size: 9,
      font: fontBold,
      color: mutedColor,
    });

    y -= 16;
    const studentName = user.fullName || user.email?.split("@")[0] || "Étudiant Faro";
    page.drawText(sanitizePdfText(studentName), {
      x: leftCol,
      y,
      size: 11,
      font: fontBold,
      color: primaryColor,
    });

    page.drawText(sanitizePdfText(`Date : ${formattedDate}`), {
      x: rightCol,
      y,
      size: 9.5,
      font: fontRegular,
      color: primaryColor,
    });

    y -= 14;
    page.drawText(sanitizePdfText(user.email || ""), {
      x: leftCol,
      y,
      size: 9.5,
      font: fontRegular,
      color: mutedColor,
    });

    page.drawText(sanitizePdfText(`Statut : ${order.status === "paid" ? "PAYE / VALIDE" : "EN ATTENTE"}`), {
      x: rightCol,
      y,
      size: 9.5,
      font: fontBold,
      color: primaryColor,
    });

    if (user.phone) {
      y -= 14;
      page.drawText(sanitizePdfText(`Tel : ${user.phone}`), {
        x: leftCol,
        y,
        size: 9.5,
        font: fontRegular,
        color: mutedColor,
      });

      page.drawText(sanitizePdfText(`Methode : ${paymentMethod}`), {
        x: rightCol,
        y,
        size: 9.5,
        font: fontRegular,
        color: primaryColor,
      });
    }

    // Table of Items
    y -= 45;
    const tableTop = y;
    const tableBottom = y - 90;

    // Table header background
    page.drawRectangle({
      x: 50,
      y: tableTop - 25,
      width: width - 100,
      height: 25,
      color: bgColor,
      borderColor,
      borderWidth: 1,
    });

    page.drawText(sanitizePdfText("DESCRIPTION"), {
      x: 65,
      y: tableTop - 17,
      size: 9,
      font: fontBold,
      color: accentColor,
    });

    page.drawText(sanitizePdfText("QUANTITE"), {
      x: 360,
      y: tableTop - 17,
      size: 9,
      font: fontBold,
      color: accentColor,
    });

    page.drawText(sanitizePdfText("TOTAL (HTG)"), {
      x: 460,
      y: tableTop - 17,
      size: 9,
      font: fontBold,
      color: accentColor,
    });

    // Row content
    y = tableTop - 50;
    page.drawText(sanitizePdfText(`Formation : ${courseTitle}`), {
      x: 65,
      y,
      size: 10,
      font: fontBold,
      color: primaryColor,
    });

    page.drawText(sanitizePdfText("1"), {
      x: 380,
      y,
      size: 10,
      font: fontRegular,
      color: primaryColor,
    });

    const amountFormatted = `${order.amount_htg.toLocaleString("fr-HT")} HTG`;
    page.drawText(sanitizePdfText(amountFormatted), {
      x: 460,
      y,
      size: 10,
      font: fontBold,
      color: primaryColor,
    });

    y -= 14;
    page.drawText(sanitizePdfText(`Acces complet et illimite en ligne - Ref: ${paymentRef}`), {
      x: 65,
      y,
      size: 8.5,
      font: fontRegular,
      color: mutedColor,
    });

    // Total section box
    y -= 40;
    page.drawLine({
      start: { x: 50, y },
      end: { x: width - 50, y },
      thickness: 1,
      color: borderColor,
    });

    y -= 30;
    page.drawText(sanitizePdfText("TOTAL REGLE :"), {
      x: 340,
      y,
      size: 11,
      font: fontBold,
      color: primaryColor,
    });

    page.drawText(sanitizePdfText(amountFormatted), {
      x: 450,
      y,
      size: 14,
      font: fontBold,
      color: primaryColor,
    });

    // Payment proof badge
    y -= 60;
    page.drawRectangle({
      x: 50,
      y: y - 10,
      width: width - 100,
      height: 50,
      color: bgColor,
      borderColor,
      borderWidth: 1,
    });

    page.drawText(sanitizePdfText("PAIEMENT ENCAISSE ET VALIDE PAR FARO SCHOOL"), {
      x: 70,
      y: y + 20,
      size: 9,
      font: fontBold,
      color: primaryColor,
    });

    page.drawText(
      sanitizePdfText(`Transaction executee via ${paymentMethod} avec succes. Ce recu tient lieu de preuve officielle d'achat.`),
      {
        x: 70,
        y: y + 5,
        size: 8,
        font: fontRegular,
        color: mutedColor,
      }
    );

    // Footer
    page.drawLine({
      start: { x: 50, y: 70 },
      end: { x: width - 50, y: 70 },
      thickness: 1,
      color: borderColor,
    });

    page.drawText(
      sanitizePdfText("Faro School - Port-au-Prince, Haiti - Support WhatsApp : +509 36 00 00 00"),
      {
        x: 50,
        y: 52,
        size: 8,
        font: fontRegular,
        color: mutedColor,
      }
    );

    page.drawText(
      sanitizePdfText("https://faroschool.com - Merci pour votre apprentissage avec nous !"),
      {
        x: 50,
        y: 40,
        size: 8,
        font: fontRegular,
        color: mutedColor,
      }
    );

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="recu-${order.reference}.pdf"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Generation du recu impossible", details: err?.message },
      { status: 500 }
    );
  }
}
