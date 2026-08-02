import { findNearbyHotels } from "@/lib/hotels";

export async function GET(request: Request) {
  const destination = new URL(request.url).searchParams.get("destination")?.slice(0, 160);
  const result = await findNearbyHotels(destination);
  if ((result.source !== "geoapify" && result.source !== "liteapi") || !result.reference) return new Response(null, { status: 404 });
  const markers = [
    `lonlat:${result.reference.longitude},${result.reference.latitude};color:#e53e13;type:awesome;text:R`,
    ...result.hotels.map((hotel, index) => `lonlat:${hotel.longitude},${hotel.latitude};color:#2457ff;type:awesome;text:${index + 1}`),
  ].join("|");
  const params = new URLSearchParams({ style: "osm-bright", width: "1000", height: "440", center: `lonlat:${result.reference.longitude},${result.reference.latitude}`, zoom: "14", marker: markers, apiKey: process.env.GEOAPIFY_API_KEY! });
  const response = await fetch(`https://maps.geoapify.com/v1/staticmap?${params}`, { next: { revalidate: 3600 } });
  if (!response.ok) return new Response(null, { status: 502 });
  return new Response(await response.arrayBuffer(), { headers: { "Content-Type": response.headers.get("content-type") || "image/png", "Cache-Control": "public, max-age=3600" } });
}
