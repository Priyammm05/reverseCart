export type HotelIdentity = {
  id: string;
  name: string;
  address: string;
  distanceKm: number;
  latitude: number;
  longitude: number;
  imageUrl?: string;
  imageSourceUrl?: string;
  imageProvider?: "liteapi" | "foursquare" | "wikimedia";
  rating?: number;
  reviewCount?: number;
  stars?: number;
  liveTotal?: number;
  rateOfferId?: string;
};

type LiteHotel = {
  id?: string; name?: string; address?: string; city?: string;
  latitude?: number; longitude?: number; main_photo?: string; thumbnail?: string;
  rating?: number; reviewCount?: number; stars?: number;
};

type GeoapifyFeature = {
  properties?: {
    place_id?: string;
    name?: string;
    formatted?: string;
    lat?: number;
    lon?: number;
  };
};

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

async function geocodeReference(query: string, apiKey: string) {
  const params = new URLSearchParams({ text: query, bias: "countrycode:in", limit: "1", format: "json", apiKey });
  const response = await fetch(`https://api.geoapify.com/v1/geocode/search?${params}`, { next: { revalidate: 86400 } });
  if (!response.ok) return null;
  const data = (await response.json()) as { results?: Array<{ lat?: number; lon?: number; formatted?: string }> };
  const match = data.results?.[0];
  return match?.lat !== undefined && match.lon !== undefined ? { latitude: match.lat, longitude: match.lon, label: match.formatted || query } : null;
}

async function findHotelImage(name: string, foursquareHotel?: { latitude: number; longitude: number }) {
  const foursquareKey = process.env.FOURSQUARE_API_KEY;
  if (foursquareKey && foursquareHotel) {
    try {
      const legacy = foursquareKey.startsWith("fsq3");
      const base = legacy ? "https://api.foursquare.com/v3" : "https://places-api.foursquare.com";
      const headers: Record<string, string> = legacy ? { Authorization: foursquareKey, Accept: "application/json" } : { Authorization: `Bearer ${foursquareKey}`, "X-Places-Api-Version": "2025-06-17", Accept: "application/json" };
      const search = new URLSearchParams({ query: name, ll: `${foursquareHotel.latitude},${foursquareHotel.longitude}`, radius: "750", limit: "3", sort: "DISTANCE", fields: legacy ? "fsq_id,name,distance" : "fsq_place_id,name,distance" });
      const searchResponse = await fetch(`${base}/places/search?${search}`, { headers, next: { revalidate: 86400 } });
      if (searchResponse.ok) {
        const searchBody = (await searchResponse.json()) as { results?: Array<{ fsq_place_id?: string; fsq_id?: string; name?: string; distance?: number }> };
        const words = name.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !["hotel", "hotels", "residency"].includes(word));
        const match = searchBody.results?.find((place) => {
          if (!(place.fsq_place_id || place.fsq_id) || !place.name || Number(place.distance || 0) > 750) return false;
          const candidate = place.name.toLowerCase();
          return words.length === 0 || words.some((word) => candidate.includes(word));
        });
        const placeId = match?.fsq_place_id || match?.fsq_id;
        if (placeId) {
          // An unfiltered query is intentional: many hotels have useful room or lobby
          // photos but no image classified specifically as a building exterior.
          const photoQuery = "limit=1&sort=POPULAR";
          const photoResponse = await fetch(`${base}/places/${placeId}/photos?${photoQuery}`, { headers, next: { revalidate: 86400 } });
          if (photoResponse.ok) {
            const photoBody = (await photoResponse.json()) as { results?: Array<{ prefix?: string; suffix?: string; url?: string }> } | Array<{ prefix?: string; suffix?: string; url?: string }>;
            const photo = Array.isArray(photoBody) ? photoBody[0] : photoBody.results?.[0];
            const imageUrl = photo?.url || (photo?.prefix && photo?.suffix ? `${photo.prefix}800x600${photo.suffix}` : undefined);
            if (imageUrl) return { imageUrl, imageSourceUrl: `https://foursquare.com/v/${placeId}`, imageProvider: "foursquare" as const };
          }
        }
      }
    } catch { /* Fall through to Wikimedia. */ }
  }
  try {
    const response = await fetch(`https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(`${name} Bengaluru hotel`)}&limit=1`, { next: { revalidate: 86400 } });
    if (!response.ok) return {};
    const data = (await response.json()) as { pages?: Array<{ title?: string; key?: string; thumbnail?: { url?: string } }> };
    const page = data.pages?.[0];
    const significant = name.toLowerCase().split(/\W+/).filter((word) => word.length > 2);
    if (!page?.title || !page.thumbnail?.url || !significant.some((word) => page.title!.toLowerCase().includes(word))) return {};
    return { imageUrl: page.thumbnail.url.startsWith("//") ? `https:${page.thumbnail.url}` : page.thumbnail.url, imageSourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.key || page.title.replace(/ /g, "_"))}`, imageProvider: "wikimedia" as const };
  } catch { return {}; }
}

function cityForLiteApi(destination?: string, label?: string) {
  const text = `${destination || ""} ${label || ""}`;
  const knownCities = ["Mumbai", "Delhi", "Jaipur", "Hyderabad", "Bengaluru", "Bangalore", "Chennai", "Kolkata", "Pune", "Goa", "Ahmedabad", "Kochi"];
  return knownCities.find((city) => new RegExp(`\\b${city}\\b`, "i").test(text)) || destination?.split(",").at(-1)?.trim() || "Bengaluru";
}

async function findLiteHotels(latitude: number, longitude: number, cityName: string) {
  const apiKey = process.env.LITEAPI_KEY;
  if (!apiKey) return [];
  try {
    const params = new URLSearchParams({ countryCode: "IN", cityName: cityName === "Bangalore" ? "Bengaluru" : cityName, limit: "200" });
    const response = await fetch(`https://api.liteapi.travel/v3.0/data/hotels?${params}`, {
      headers: { "X-API-Key": apiKey, Accept: "application/json" }, next: { revalidate: 86400 },
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { data?: LiteHotel[] };
    return (body.data || []).flatMap((hotel) => {
      if (!hotel.id || !hotel.name || hotel.latitude === undefined || hotel.longitude === undefined) return [];
      return [{
        id: hotel.id, name: hotel.name,
        address: [hotel.address, hotel.city].filter(Boolean).join(", ") || "Bengaluru",
        distanceKm: Number(distanceKm(latitude, longitude, hotel.latitude, hotel.longitude).toFixed(1)),
        latitude: hotel.latitude, longitude: hotel.longitude,
        imageUrl: hotel.main_photo || hotel.thumbnail,
        imageSourceUrl: "https://liteapi.travel/", imageProvider: "liteapi" as const,
        rating: hotel.rating, reviewCount: hotel.reviewCount, stars: hotel.stars,
      }];
    }).filter((hotel) => hotel.distanceKm <= 15 && hotel.imageUrl)
      .sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 20);
  } catch { return []; }
}

async function addLiteRates(hotels: HotelIdentity[], stay?: { checkin: string; checkout: string; guests: number; rooms: number }) {
  if (!stay || hotels.length === 0) return hotels;
  const apiKey = process.env.LITEAPI_KEY;
  if (!apiKey) return hotels;
  try {
    const occupancies = Array.from({ length: Math.max(1, stay.rooms) }, (_, index) => ({
      adults: Math.max(1, Math.floor(stay.guests / stay.rooms) + (index < stay.guests % stay.rooms ? 1 : 0)),
    }));
    const response = await fetch("https://api.liteapi.travel/v3.0/hotels/min-rates", {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ hotelIds: hotels.map((hotel) => hotel.id), occupancies, checkin: stay.checkin, checkout: stay.checkout, currency: "INR", guestNationality: "IN" }),
      cache: "no-store",
    });
    if (!response.ok) return hotels;
    const body = (await response.json()) as { data?: Array<{ hotelId?: string; price?: number; suggestedSellingPrice?: number; offerId?: string }> };
    const rates = new Map((body.data || []).map((rate) => [rate.hotelId, rate]));
    return hotels.map((hotel) => {
      const rate = rates.get(hotel.id);
      const total = rate?.suggestedSellingPrice || rate?.price;
      return total ? { ...hotel, liveTotal: Number(total.toFixed(2)), rateOfferId: rate?.offerId } : hotel;
    });
  } catch { return hotels; }
}

export async function findNearbyHotels(destination?: string, stay?: { checkin: string; checkout: string; guests: number; rooms: number }) {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) return { source: "fixture" as const, hotels: [] as HotelIdentity[] };
  const geocoded = destination ? await geocodeReference(destination, apiKey) : null;
  const latitude = geocoded?.latitude ?? Number(process.env.REVERSECART_VENUE_LAT || 12.9716);
  const longitude = geocoded?.longitude ?? Number(process.env.REVERSECART_VENUE_LON || 77.5946);
  const liteHotels = await findLiteHotels(latitude, longitude, cityForLiteApi(destination, geocoded?.label));
  if (liteHotels.length >= 3) {
    const ratedHotels = await addLiteRates(liteHotels, stay);
    const available = ratedHotels.filter((hotel) => hotel.liveTotal).slice(0, 3);
    const hotels = available.length >= 3 ? available : ratedHotels.slice(0, 3);
    return { source: "liteapi" as const, reference: { latitude, longitude, label: geocoded?.label || destination || "Configured venue" }, hotels };
  }
  const params = new URLSearchParams({
    categories: "accommodation.hotel",
    filter: `circle:${longitude},${latitude},6000`,
    bias: `proximity:${longitude},${latitude}`,
    limit: "10",
    apiKey,
  });
  const response = await fetch(`https://api.geoapify.com/v2/places?${params}`, { next: { revalidate: 3600 } });
  if (!response.ok) return { source: "fixture" as const, hotels: [] as HotelIdentity[] };
  const data = (await response.json()) as { features?: GeoapifyFeature[] };
  const identities = (data.features || []).flatMap((feature) => {
    const item = feature.properties;
    if (!item?.place_id || !item.name || item.lat === undefined || item.lon === undefined) return [];
    return [{ id: item.place_id, name: item.name, address: item.formatted || "Bengaluru", distanceKm: Number(distanceKm(latitude, longitude, item.lat, item.lon).toFixed(1)), latitude: item.lat, longitude: item.lon }];
  }).slice(0, 3);
  const hotels = await Promise.all(identities.map(async (hotel) => ({ ...hotel, ...await findHotelImage(hotel.name, hotel) })));
  return { source: hotels.length >= 3 ? "geoapify" as const : "fixture" as const, reference: { latitude, longitude, label: geocoded?.label || destination || "Configured venue" }, hotels };
}
