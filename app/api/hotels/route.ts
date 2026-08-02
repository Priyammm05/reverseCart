import { NextResponse } from "next/server";
import { findNearbyHotels } from "@/lib/hotels";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const destination = params.get("destination")?.slice(0, 160);
  const checkin = params.get("checkin") || "";
  const checkout = params.get("checkout") || "";
  const guests = Math.min(12, Math.max(1, Number(params.get("guests") || 1)));
  const rooms = Math.min(6, Math.max(1, Number(params.get("rooms") || 1)));
  const stay = /^\d{4}-\d{2}-\d{2}$/.test(checkin) && /^\d{4}-\d{2}-\d{2}$/.test(checkout) ? { checkin, checkout, guests, rooms } : undefined;
  return NextResponse.json(await findNearbyHotels(destination, stay));
}
