import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

export async function POST() {
  try {
    const supabase = await createClient();
    try {
      await supabase.auth.signOut();
    } catch {}

    const response = NextResponse.json({ success: true });
    return response;
  } catch (err: any) {
    console.error("Signout route error:", err);
    return NextResponse.json({ error: "serverError" }, { status: 500 });
  }
}
