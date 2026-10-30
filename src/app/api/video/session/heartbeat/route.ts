import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { registerOrHeartbeatSession } from "@/lib/video/session";

export const runtime = "nodejs";

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

    const userAgent = req.headers.get("user-agent") || undefined;
    const result = await registerOrHeartbeatSession(user.id, deviceId, userAgent);

    if (!result.allowed) {
      return NextResponse.json(
        {
          allowed: false,
          error: "deviceLimitExceeded",
          activeDevicesCount: result.activeDevicesCount,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      allowed: true,
      activeDevicesCount: result.activeDevicesCount,
      sessionId: result.sessionId,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Erreur de session", message: err?.message },
      { status: 500 }
    );
  }
}
