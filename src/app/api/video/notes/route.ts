import {checkLessonAccess} from "@/lib/video/access";
import {saveLessonNoteAction} from "@/app/actions/video";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic="force-dynamic";

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

    if(!(await checkLessonAccess(lessonId,user.id)).canAccess)return NextResponse.json({error:"forbidden"},{status:403});
    const supabase = await createClient();
    const { data: note,error } = await supabase
      .from("lesson_notes")
      .select("content, updated_at")
      .eq("user_id", user.id)
      .eq("lesson_id", lessonId)
      .maybeSingle();

    if(error)return NextResponse.json({error:"note_unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});
    return NextResponse.json({
      content: note?.content || "",
      updatedAt: note?.updated_at || null,
    },{headers:{"Cache-Control":"no-store"}});
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

    const result=await saveLessonNoteAction(lessonId,content);
    if(!result.success)return NextResponse.json({error:'note_unavailable'},{status:400});

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Erreur serveur", message: err?.message },
      { status: 500 }
    );
  }
}
