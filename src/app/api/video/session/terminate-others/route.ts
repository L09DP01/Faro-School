import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { terminateOtherSessions, registerOrHeartbeatSession } from "@/lib/video/session";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await req.json();
    const { deviceId } = body;

    if (!deviceId || typeof deviceId !== "string") {
      return NextResponse.json(
        { error: "Identifiant d'appareil manquant" },
        { status: 400 }
      );
    }

    const { terminatedCount } = await terminateOtherSessions(user.id, deviceId);
    const userAgent = req.headers.get("user-agent") || undefined;
    const session = await registerOrHeartbeatSession(user.id, deviceId, userAgent);

    return NextResponse.json({
      success: true,
      terminatedCount,
      allowed: session.allowed,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Impossible de clore les sessions", message: err?.message },
      { status: 500 }
    );
  }
}
