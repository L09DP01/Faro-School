import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { eligibility } from "@/lib/certificates/service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await req.json();
    const { lessonId, positionSec = 0, markCompleted = false } = body;

    if (!lessonId) {
      return NextResponse.json(
        { error: "Identifiant de leçon manquant" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. Get existing progress
    const { data: existing } = await supabase
      .from("lesson_progress")
      .select("completed_at")
      .eq("user_id", user.id)
      .eq("lesson_id", lessonId)
      .maybeSingle();

    const isAlreadyCompleted = Boolean(existing?.completed_at);
    const finalCompletedAt =
      markCompleted || isAlreadyCompleted
        ? existing?.completed_at || new Date().toISOString()
        : null;

    // 2. Upsert progress
    const { error: upsertError } = await supabase
      .from("lesson_progress")
      .upsert(
        {
          user_id: user.id,
          lesson_id: lessonId,
          last_position_sec: Math.max(0, Math.floor(positionSec)),
          completed_at: finalCompletedAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,lesson_id" }
      );

    if (upsertError) {
      return NextResponse.json(
        { error: "Échec de sauvegarde de progression", details: upsertError.message },
        { status: 500 }
      );
    }

    // 3. If marked complete, check if the whole course is complete and issue certificate
    let certResult: { issued: boolean; code?: string; available?:boolean } = { issued: false, code: undefined };
    if (finalCompletedAt) {
      const { data: lesson } = await supabase
        .from("lessons")
        .select("modules!inner(course_id)")
        .eq("id", lessonId)
        .single();

      const courseId = (lesson?.modules as any)?.course_id;
      if (courseId) {
        certResult = await eligibility(user.id, courseId).then(e=>({issued:false,code:undefined,available:e.eligible && !e.certificate}));
      }
    }

    return NextResponse.json({
      success: true,
      completed: Boolean(finalCompletedAt),
      certificateAvailable: certResult.available??false,
      certificateIssued: false,
      certificateCode: certResult.code,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Erreur serveur", message: err?.message },
      { status: 500 }
    );
  }
}
