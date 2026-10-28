import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Payment Return Handler:
 * Security constraints:
 * - NEVER updates payment or order status based on query parameters.
 * - NEVER sets status to 'failed' or 'validated' from client redirects.
 * - Simply locates the order in the database and safely redirects the user to the confirmation page.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const orderId = searchParams.get("orderId") || searchParams.get("order_id");
  const reference = searchParams.get("reference") || "";

  if (!orderId && !reference) {
    return NextResponse.redirect(
      new URL("/fr?error=missing_payment_ref", request.url)
    );
  }

  const supabaseAdmin = createAdminClient();

  // Find order safely without mutating any status
  let query = supabaseAdmin.from("orders").select("id, reference, status");

  if (orderId) {
    query = query.eq("id", orderId);
  } else if (reference) {
    query = query.eq("reference", reference);
  }

  const { data: order } = await query.maybeSingle();

  if (!order) {
    return NextResponse.redirect(
      new URL("/fr?error=order_not_found", request.url)
    );
  }

  // Redirect student strictly to confirmation screen; confirmation reads status directly from DB
  return NextResponse.redirect(
    new URL(`/fr/confirmation/${order.id}`, request.url)
  );
}
