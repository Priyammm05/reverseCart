import { NextResponse } from "next/server";
import { createPravaSession, PravaApiError } from "@/lib/prava";
import { DemoPaymentGateway } from "@/lib/payment";
import { createClient, currentUser } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = (await request.json()) as { amount?: number; merchant?: string; requestId?: string };
  if (!body.amount || !body.merchant || !body.requestId || body.amount <= 0 || body.amount > 500000) return NextResponse.json({ error: "Invalid payment request." }, { status: 400 });

  let reservationId = "playwright-reservation";
  if (process.env.PLAYWRIGHT_BYPASS_AUTH !== "1") {
    const supabase = await createClient();
    const { data: owned } = await supabase.from("purchase_requests").select("id,max_total_minor").eq("id", body.requestId).eq("user_id", user.id).single();
    if (!owned) return NextResponse.json({ error: "Purchase request not found." }, { status: 404 });
    if (body.amount * 100 > owned.max_total_minor) return NextResponse.json({ error: "The selected offer exceeds this request's authorized maximum." }, { status: 400 });
    const { data: reservation, error } = await supabase.from("reservations").insert({ user_id: user.id, request_id: body.requestId, merchant_name: body.merchant, amount_minor: body.amount * 100, status: "pending_payment" }).select("id").single();
    if (error || !reservation) return NextResponse.json({ error: error?.message || "Could not create reservation." }, { status: 500 });
    reservationId = reservation.id;
    await supabase.from("purchase_requests").update({ status: "payment_pending", updated_at: new Date().toISOString() }).eq("id", body.requestId).eq("user_id", user.id);
  }

  if (!process.env.PRAVA_SECRET_KEY) {
    const result = await new DemoPaymentGateway().confirmPayment({ amount: body.amount, merchant: body.merchant });
    if (process.env.PLAYWRIGHT_BYPASS_AUTH !== "1") {
      const supabase = await createClient();
      await supabase.from("reservations").update({ status: "confirmed", booking_reference: result.bookingReference, confirmed_at: result.confirmedAt }).eq("id", reservationId).eq("user_id", user.id);
      await supabase.from("payment_events").insert({ user_id: user.id, request_id: body.requestId, reservation_id: reservationId, provider: "demo", provider_transaction_id: result.transactionId, amount_minor: body.amount * 100, status: "completed" });
      await supabase.from("purchase_requests").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", body.requestId).eq("user_id", user.id);
    }
    return NextResponse.json({ mode: "demo", result, reservationId });
  }

  try {
    const externalOrderRef = `RC-${crypto.randomUUID()}`;
    const session = await createPravaSession({ amountMinor: body.amount * 100, merchant: body.merchant, externalOrderRef });
    if (process.env.PLAYWRIGHT_BYPASS_AUTH !== "1") {
      const supabase = await createClient();
      await supabase.from("payment_events").insert({ user_id: user.id, request_id: body.requestId, reservation_id: reservationId, provider: "prava", provider_session_id: session.session_id, amount_minor: body.amount * 100, status: "pending" });
    }
    return NextResponse.json({ mode: "prava", sessionId: session.session_id, checkoutUrl: session.iframe_url, expiresAt: session.expires_at, externalOrderRef, reservationId });
  } catch (error) {
    if (error instanceof PravaApiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: "Unable to start Prava checkout." }, { status: 500 });
  }
}
