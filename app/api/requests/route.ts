import { NextResponse } from "next/server";
import { createClient, currentUser } from "@/lib/supabase/server";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (process.env.PLAYWRIGHT_BYPASS_AUTH === "1") return NextResponse.json({ requests: [] });
  const supabase = await createClient();
  const { data, error } = await supabase.from("purchase_requests").select("*, offers!offers_request_id_fkey(*)").order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = (await request.json()) as { rawPrompt?: string; destination?: string; timing?: string; guests?: number; rooms?: number; maxTotalMinor?: number; required?: string[]; preferred?: string[] };
  if (!body.rawPrompt || !body.destination || !body.timing || !body.guests || !body.rooms || !body.maxTotalMinor) return NextResponse.json({ error: "Invalid purchase request." }, { status: 400 });
  if (process.env.PLAYWRIGHT_BYPASS_AUTH === "1") return NextResponse.json({ request: { id: "playwright-request", user_id: user.id, ...body } }, { status: 201 });
  const supabase = await createClient();
  const { data, error } = await supabase.from("purchase_requests").insert({ user_id: user.id, raw_prompt: body.rawPrompt, destination: body.destination, timing: body.timing, guests: body.guests, rooms: body.rooms, max_total_minor: body.maxTotalMinor, required_constraints: body.required || [], preferred_constraints: body.preferred || [], status: "draft" }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data }, { status: 201 });
}
