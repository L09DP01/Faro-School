import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-user";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Accès refusé : rôle administrateur requis." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Format non supporté. Seuls JPG, PNG et WEBP sont acceptés." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Taille maximale dépassée. L'image ne doit pas excéder 3 Mo." },
        { status: 400 }
      );
    }

    // Convert file to Data URL for instant resilient preview & storage in prototype/dev,
    // or upload to Bunny Storage if configured
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    return NextResponse.json({
      success: true,
      url: dataUrl,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Erreur lors du téléversement de l'image." },
      { status: 500 }
    );
  }
}
