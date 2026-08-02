import { NextResponse } from "next/server";
import { createClient, currentUser } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (process.env.PLAYWRIGHT_BYPASS_AUTH === "1") return NextResponse.json({ request: null, offers: [], reservations: [], payments: [] });
  const supabase = await createClient();
  const [requestResult, offersResult, reservationsResult, paymentsResult] = await Promise.all([
    supabase.from("purchase_requests").select("*").eq("id", params.id).eq("user_id", user.id).single(),
    supabase.from("offers").select("*").eq("request_id", params.id).order("score", { ascending: false }),
    supabase.from("reservations").select("*").eq("request_id", params.id).eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("payment_events").select("*").eq("request_id", params.id).eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);
  if (requestResult.error) return NextResponse.json({ error: requestResult.error.message }, { status: requestResult.error.code === "PGRST116" ? 404 : 500 });
  return NextResponse.json({ request: requestResult.data, offers: offersResult.data || [], reservations: reservationsResult.data || [], payments: paymentsResult.data || [] });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = (await request.json()) as { status?: string; selectedMerchantId?: string; offers?: Array<{ merchantId: string; merchantName: string; totalMinor: number; benefits: string[]; cancellation: string; distanceKm: number; score: number; selected: boolean }> };
  if (process.env.PLAYWRIGHT_BYPASS_AUTH === "1") return NextResponse.json({ ok: true });
  const supabase = await createClient();
  if (body.offers?.length) {
    const { error } = await supabase.from("offers").upsert(body.offers.map((offer) => ({ request_id: params.id, merchant_id: offer.merchantId, merchant_name: offer.merchantName, total_minor: offer.totalMinor, benefits: offer.benefits, cancellation: offer.cancellation, distance_km: offer.distanceKm, score: offer.score, selected: offer.selected })), { onConflict: "request_id,merchant_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const { error } = await supabase.from("purchase_requests").update({ status: body.status || "selected", updated_at: new Date().toISOString() }).eq("id", params.id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
