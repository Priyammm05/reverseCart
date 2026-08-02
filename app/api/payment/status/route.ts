import { NextResponse } from "next/server";
import { executeMerchantCheckout, getPravaPaymentResult, PravaApiError, reportPravaStatus } from "@/lib/prava";
import { createClient, currentUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  const reservationId = new URL(request.url).searchParams.get("reservationId");
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const userId = user.id;
  if (!sessionId || !/^sess?_[-a-zA-Z0-9]+$/.test(sessionId)) return NextResponse.json({ error: "Invalid session." }, { status: 400 });
  try {
    const result = await getPravaPaymentResult(sessionId);
    const lineItems = result.transactions.flatMap((transaction) => transaction.line_items || []);
    console.info("[prava-status]", {
      session: sessionId.slice(-8),
      providerStatus: result.status,
      transactionStatuses: result.transactions.map((transaction) => transaction.status),
      lineItemStatuses: lineItems.map((item) => item.status),
      credentialReady: lineItems.map((item) => Boolean(item.token && item.dynamic_cvv && item.expiry_month && item.expiry_year)),
    });
    if (result.status === "failed") { await persistStatus("payment_failed"); return NextResponse.json({ status: "failed" }); }
    if (result.status === "completed") {
      await persistStatus("confirmed", result.transactions[0]?.txn_id, `RC-${result.order_id}`);
      return NextResponse.json({ status: "confirmed", transactionId: result.transactions[0]?.txn_id, bookingReference: `RC-${result.order_id}`, confirmedAt: new Date().toISOString() });
    }

    const lineItem = lineItems.find((item) => {
      const status = item.status.toLowerCase().replace(/[^a-z]+/g, "_");
      return status === "awaiting_result" ||
        status === "creds_generated" ||
        Boolean(item.token && item.dynamic_cvv && item.expiry_month && item.expiry_year);
    });
    if (!lineItem) return NextResponse.json({ status: "pending", providerStatus: result.status });
    const checkout = await executeMerchantCheckout(lineItem);
    console.info("[prava-merchant-checkout]", { session: sessionId.slice(-8), status: checkout.status });
    if (checkout.status === "configuration_required") return NextResponse.json({ status: "merchant_checkout_required", message: "Configure REVERSECART_MERCHANT_CHECKOUT_URL to execute the hotel charge." });
    if (checkout.status === "credentials_not_ready") return NextResponse.json({ status: "pending" });

    await reportPravaStatus({ sessionId, transactionReference: lineItem.txn_ref_id, approved: checkout.status === "approved", authorizationCode: checkout.authorizationCode, responseCode: checkout.responseCode, amountPaid: lineItem.total_amount });
    if (checkout.status !== "approved") { await persistStatus("payment_failed"); return NextResponse.json({ status: "failed" }); }
    await persistStatus("confirmed", checkout.transactionId || lineItem.txn_ref_id, `RC-${result.order_id}`);
    return NextResponse.json({ status: "confirmed", transactionId: checkout.transactionId || lineItem.txn_ref_id, bookingReference: `RC-${result.order_id}`, confirmedAt: new Date().toISOString() });
  } catch (error) {
    if (error instanceof PravaApiError) {
      console.error("[prava-api-error]", { session: sessionId?.slice(-8), status: error.status, code: error.code, message: error.message });
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[payment-status-error]", { session: sessionId?.slice(-8), message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ error: "Unable to verify payment." }, { status: 500 });
  }

  async function persistStatus(status: "confirmed" | "payment_failed", transactionId?: string, bookingReference?: string) {
    if (!reservationId || process.env.PLAYWRIGHT_BYPASS_AUTH === "1") return;
    const supabase = await createClient();
    const { data: reservation } = await supabase.from("reservations").update({ status, booking_reference: bookingReference, confirmed_at: status === "confirmed" ? new Date().toISOString() : null }).eq("id", reservationId).eq("user_id", userId).select("request_id").single();
    await supabase.from("payment_events").update({ status: status === "confirmed" ? "completed" : "failed", provider_transaction_id: transactionId }).eq("reservation_id", reservationId).eq("user_id", userId);
    if (reservation?.request_id) await supabase.from("purchase_requests").update({ status: status === "confirmed" ? "completed" : "selected", updated_at: new Date().toISOString() }).eq("id", reservation.request_id).eq("user_id", userId);
  }
}
