export type Stage = "request" | "review" | "bidding" | "decision" | "payment" | "confirmed";

export type Offer = {
  id: string;
  hotel: string;
  mark: string;
  color: string;
  price: number;
  openingPrice: number;
  distance: number;
  rating: number;
  benefits: string[];
  cancellation: string;
  selected?: boolean;
  address?: string;
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
  imageSourceUrl?: string;
  imageProvider?: "liteapi" | "foursquare" | "wikimedia";
  dataSource?: "liteapi" | "geoapify" | "fixture";
};

export type BidEvent = {
  at: number;
  hotel: string;
  message: string;
  price?: number;
};

export const initialOffers: Offer[] = [
  {
    id: "mora",
    hotel: "Mora House",
    mark: "M",
    color: "#FF6B35",
    price: 7600,
    openingPrice: 7600,
    distance: 3.8,
    rating: 4.6,
    benefits: ["Late check-in", "Free Wi-Fi"],
    cancellation: "Non-refundable",
    dataSource: "fixture",
  },
  {
    id: "luma",
    hotel: "Luma Bengaluru",
    mark: "L",
    color: "#6C5CE7",
    price: 7900,
    openingPrice: 7900,
    distance: 1.7,
    rating: 4.8,
    benefits: ["Late check-in", "Breakfast included"],
    cancellation: "Free until 8 PM",
    dataSource: "fixture",
  },
  {
    id: "soma",
    hotel: "Soma Residency",
    mark: "S",
    color: "#00A896",
    price: 7800,
    openingPrice: 7800,
    distance: 2.6,
    rating: 4.7,
    benefits: ["Late check-in", "Free cancellation"],
    cancellation: "Free until 10 PM",
    dataSource: "fixture",
  },
];

export const bidEvents: BidEvent[] = [
  { at: 1, hotel: "Mora House", message: "opened at", price: 7600 },
  { at: 3, hotel: "Luma Bengaluru", message: "added breakfast at", price: 7900 },
  { at: 5, hotel: "Soma Residency", message: "added free cancellation at", price: 7800 },
  { at: 8, hotel: "Mora House", message: "dropped its price to", price: 7300 },
  { at: 11, hotel: "Luma Bengaluru", message: "added late checkout at", price: 7900 },
  { at: 14, hotel: "Luma Bengaluru", message: "made its final offer at", price: 7600 },
];

export function formatINR(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function scoreOffer(offer: Offer) {
  const priceScore = Math.max(0, 1 - (offer.price - 7000) / 2000);
  const distanceScore = Math.max(0, 1 - offer.distance / 8);
  const breakfastScore = offer.benefits.some((item) => item.toLowerCase().includes("breakfast")) ? 1 : 0;
  const cancellationScore = offer.cancellation.toLowerCase().includes("free") ? 1 : 0;
  const convenienceScore = offer.benefits.some((item) => item.toLowerCase().includes("checkout")) ? 1 : 0;

  return Math.round(
    (priceScore * 0.45 +
      distanceScore * 0.2 +
      cancellationScore * 0.15 +
      breakfastScore * 0.1 +
      convenienceScore * 0.1) *
      100,
  );
}
