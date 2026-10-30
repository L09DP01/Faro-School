import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const lessonId = searchParams.get("lessonId");
    if (!lessonId) {
      return NextResponse.json({ error: "lessonId manquant" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: note } = await supabase
      .from("lesson_notes")
      .select("content, updated_at")
      .eq("user_id", user.id)
      .eq("lesson_id", lessonId)
      .maybeSingle();

    return NextResponse.json({
      content: note?.content || "",
      updatedAt: note?.updated_at || null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Erreur serveur", message: err?.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await req.json();
    const { lessonId, content = "" } = body;
    if (!lessonId) {
      return NextResponse.json({ error: "lessonId manquant" }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("lesson_notes")
      .upsert(
        {
          user_id: user.id,
          lesson_id: lessonId,
          content: String(content),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,lesson_id" }
      );

    if (error) {
      return NextResponse.json(
        { error: "Échec de sauvegarde de note", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Erreur serveur", message: err?.message },
      { status: 500 }
    );
  }
}
