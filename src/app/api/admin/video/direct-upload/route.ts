import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getVideoProvider, BunnyStreamProvider } from "@/lib/video";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Accès refusé : rôle administrateur requis." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const title = (body.title as string) || "Nouvelle leçon Faro School";

    const hasBunnyConfig =
      Boolean(process.env.BUNNY_STREAM_API_KEY) &&
      Boolean(process.env.BUNNY_STREAM_LIBRARY_ID);

    if (hasBunnyConfig) {
      const provider = new BunnyStreamProvider();
      const directUpload = await provider.createDirectUpload(title);
      return NextResponse.json({
        mock: false,
        videoId: directUpload.videoId,
        uploadUrl: directUpload.uploadUrl,
        authorizationSignature: directUpload.authorizationSignature,
        authorizationExpire: directUpload.authorizationExpire,
        libraryId: directUpload.libraryId,
      });
    }

    // MOCK mode: Zero-credential simulation
    const mockId = `mock_vid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    return NextResponse.json({
      mock: true,
      videoId: mockId,
      uploadUrl: "https://httpbin.org/post",
      durationSec: 720,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Erreur lors de la génération de l'upload direct." },
      { status: 500 }
    );
  }
}
