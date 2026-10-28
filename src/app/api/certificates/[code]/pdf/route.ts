import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createAdminClient } from "@/lib/supabase/admin";

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
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const cleanCode = code.trim().toUpperCase();

    const supabase = createAdminClient();
    const { data: cert, error } = await supabase
      .from("certificates")
      .select(`
        id,
        code,
        issued_at,
        profiles (
          full_name,
          email
        ),
        courses (
          title_fr,
          title_ht
        )
      `)
      .eq("code", cleanCode)
      .maybeSingle();

    if (error || !cert) {
      return NextResponse.json(
        { error: "Certificat introuvable" },
        { status: 404 }
      );
    }

    const profileData = cert.profiles as { full_name?: string; email?: string } | null;
    const studentName = profileData?.full_name || profileData?.email?.split("@")[0] || "Étudiant Faro";

    const courseData = cert.courses as { title_fr?: string; title_ht?: string } | null;
    const courseTitle = courseData?.title_fr || "Formation Professionnelle";

    const issueDate = new Date(cert.issued_at).toLocaleDateString("fr-HT", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Generate Landscape Certificate A4 PDF (841.89 x 595.28 points)
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([841.89, 595.28]);
    const { width, height } = page.getSize();

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Color definitions (Faro School tokens)
    const navyDeep = rgb(0.012, 0.063, 0.278); // #031047
    const navy = rgb(0.043, 0.122, 0.294);     // #0B1F4B
    const amber = rgb(1.0, 0.498, 0.055);      // #FF7F0E
    const mutedDark = rgb(0.357, 0.392, 0.471);// #5B6478

    // Refined Double Border: Outer Thin Navy & Inner Thin Amber
    page.drawRectangle({
      x: 24,
      y: 24,
      width: width - 48,
      height: height - 48,
      borderColor: navy,
      borderWidth: 2,
    });

    page.drawRectangle({
      x: 32,
      y: 32,
      width: width - 64,
      height: height - 64,
      borderColor: amber,
      borderWidth: 1,
    });

    // Top logo / organization name
    page.drawText(sanitizePdfText("FARO SCHOOL"), {
      x: width / 2 - 100,
      y: height - 85,
      size: 24,
      font: fontBold,
      color: navyDeep,
    });

    page.drawText(sanitizePdfText("CERTIFICAT DE REUSSITE"), {
      x: width / 2 - 135,
      y: height - 120,
      size: 15,
      font: fontBold,
      color: amber,
    });

    page.drawText(sanitizePdfText("Ce certificat officiel est decerne a :"), {
      x: width / 2 - 120,
      y: height - 158,
      size: 11,
      font: fontRegular,
      color: mutedDark,
    });

    // Large serif-free display name
    const studentText = sanitizePdfText(studentName.toUpperCase());
    const studentTextWidth = studentText.length * 13;
    page.drawText(studentText, {
      x: Math.max(50, width / 2 - studentTextWidth / 2),
      y: height - 208,
      size: 26,
      font: fontBold,
      color: navyDeep,
    });

    // Underline beneath student name
    page.drawLine({
      start: { x: width / 2 - 180, y: height - 222 },
      end: { x: width / 2 + 180, y: height - 222 },
      thickness: 1.5,
      color: amber,
    });

    // Award description
    page.drawText(
      sanitizePdfText("pour avoir complete avec succes l'integralite des modules et lecons de la formation :"),
      {
        x: width / 2 - 210,
        y: height - 260,
        size: 11,
        font: fontRegular,
        color: mutedDark,
      }
    );

    // Course title
    const courseText = sanitizePdfText(`"${courseTitle}"`);
    const courseTextWidth = courseText.length * 9;
    page.drawText(courseText, {
      x: Math.max(50, width / 2 - courseTextWidth / 2),
      y: height - 305,
      size: 18,
      font: fontBold,
      color: navy,
    });

    // Verification code and issue date box
    page.drawText(sanitizePdfText(`Date d'emission : ${issueDate}`), {
      x: 70,
      y: 95,
      size: 10,
      font: fontRegular,
      color: navyDeep,
    });

    page.drawText(sanitizePdfText(`Numero de serie : ${cert.code}`), {
      x: 70,
      y: 75,
      size: 10,
      font: fontBold,
      color: navyDeep,
    });

    page.drawText(sanitizePdfText(`Verification en ligne : https://faroschool.com/verifier/${cert.code}`), {
      x: 70,
      y: 55,
      size: 8.5,
      font: fontRegular,
      color: mutedDark,
    });

    // Signatures
    page.drawLine({
      start: { x: width - 260, y: 100 },
      end: { x: width - 70, y: 100 },
      thickness: 1,
      color: amber,
    });

    page.drawText(sanitizePdfText("Jean-Marc Joseph"), {
      x: width - 220,
      y: 80,
      size: 11,
      font: fontBold,
      color: navyDeep,
    });

    page.drawText(sanitizePdfText("Directeur & Formateur Faro School"), {
      x: width - 245,
      y: 65,
      size: 8.5,
      font: fontRegular,
      color: mutedDark,
    });

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="certificat-${cert.code}.pdf"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Generation du certificat impossible", message: err?.message },
      { status: 500 }
    );
  }
}
