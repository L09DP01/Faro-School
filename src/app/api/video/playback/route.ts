import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getVideoProvider, checkLessonAccess } from "@/lib/video";

export const runtime = "nodejs";
const json=(body:unknown,init:ResponseInit={})=>NextResponse.json(body,{...init,headers:{"Cache-Control":"no-store"}});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lessonId = searchParams.get("lessonId");

    if (!lessonId) {
      return json(
        { error: "Paramètre lessonId manquant" },
        { status: 400 }
      );
    }

    const user = await getCurrentUser();
    const userId = user?.id || "";

    // Check access permissions
    const access = await checkLessonAccess(lessonId, userId);

    if (!access.canAccess) {
      return json(
        {
          error: "Accès refusé : cette leçon est réservée aux étudiants inscrits.",
          locked: true,
        },
        { status: 403 }
      );
    }

    const videoProvider = getVideoProvider();
    const playbackUrl = await videoProvider.getPlaybackUrl(lessonId, userId);

    return json({
      success: true,
      playbackUrl,
      isFreePreview: access.isFreePreview,
      videoId: access.videoId,
    });
  } catch (err: any) {
    const status = err.message?.includes("Accès refusé") ? 403 : 500;
    return json(
      { error: err.message || "Erreur lors de la récupération de la vidéo" },
      { status }
    );
  }
}
