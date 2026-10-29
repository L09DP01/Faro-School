import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "edge";

export async function POST() {
  try {
    const cookieStore = await cookies();
    // Clear Auth.js session cookies
    cookieStore.delete("authjs.session-token");
    cookieStore.delete("__Secure-authjs.session-token");
    cookieStore.delete("authjs.csrf-token");
    cookieStore.delete("__Host-authjs.csrf-token");

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Signout route error:", err);
    return NextResponse.json({ error: "serverError" }, { status: 500 });
  }
}
