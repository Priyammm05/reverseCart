export type InterpretedRequest = {
  destination: string;
  timing: string;
  guests: number;
  rooms: number;
  maxTotalMinor: number;
  required: string[];
  preferred: string[];
  legs?: Array<{ destination: string; timing: string }>;
};

export const fallbackInterpretation: InterpretedRequest = {
  destination: "Hackathon venue, Bengaluru",
  timing: "Tonight to tomorrow",
  guests: 1,
  rooms: 1,
  maxTotalMinor: 800000,
  required: ["Late check-in", "Within 5 km"],
  preferred: ["Breakfast"],
};

export function destinationFromPrompt(prompt: string, fallback = fallbackInterpretation.destination) {
  const near = prompt.match(/\bnear\s+(.+?)(?=,?\s+(?:tonight|tomorrow|this\s+weekend|next\s+\w+|under|below|within|with|for\s+(?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+night|\d+\s+(?:guests?|nights?)))\b|$)/i)?.[1];
  if (near) return near.replace(/[,.\s]+$/, "").trim();
  const place = prompt.match(/\b(?:in|at)\s+([A-Z][\w\s.-]+?)(?=,?\s+(?:tonight|tomorrow|this\s+weekend|next\s+\w+|under|below|with|for)\b|$)/)?.[1];
  return place?.replace(/[,.\s]+$/, "").trim() || fallback;
}

export function interpretFallback(prompt: string): InterpretedRequest {
  const rooms = Number(prompt.match(/\b(\d+)\s+rooms?\b/i)?.[1] || 1);
  const guests = Number(prompt.match(/\b(\d+)\s+(?:guests?|people|adults?)\b/i)?.[1] || Math.max(1, rooms));
  const budgetMatch = prompt.match(/(?:₹|rs\.?|inr)\s*([\d,.]+)\s*(k)?|(?:under|below|max(?:imum)?)\s+(?:₹|rs\.?|inr)?\s*([\d,.]+)\s*(k)?/i);
  const rawBudget = budgetMatch?.[1] || budgetMatch?.[3];
  const thousands = Boolean(budgetMatch?.[2] || budgetMatch?.[4]);
  const rupees = rawBudget ? Number(rawBudget.replace(/,/g, "")) * (thousands ? 1000 : 1) : 8000;
  const timing = /this\s+weekend/i.test(prompt) ? "This weekend" : /tomorrow/i.test(prompt) && !/tonight/i.test(prompt) ? "Tomorrow" : /tonight/i.test(prompt) ? "Tonight to tomorrow" : "Dates flexible";
  const required: string[] = [];
  const preferred: string[] = [];
  if (/late\s+check[ -]?in/i.test(prompt)) required.push("Late check-in");
  if (/accessible|wheelchair/i.test(prompt)) required.push("Accessible room");
  const distance = prompt.match(/within\s+(\d+(?:\.\d+)?)\s*km/i)?.[1];
  if (distance) required.push(`Within ${distance} km`);
  if (/breakfast/i.test(prompt)) preferred.push("Breakfast");
  if (/free\s+cancell?ation/i.test(prompt)) preferred.push("Free cancellation");
  if (/airport\s+shuttle|free\s+shuttle/i.test(prompt)) preferred.push("Airport shuttle");
  if (/\bwi-?fi\b/i.test(prompt)) preferred.push("Wi-Fi");
  const primaryDestination = destinationFromPrompt(prompt);
  const another = prompt.match(/\b(?:another|then)\s+(?:hotel\s+)?near\s+(.+?)(?=,?\s+(?:on|for|under|with|and\s+(?:a\s+)?combined)\b|$)/i)?.[1]?.replace(/[,.\s]+$/, "").trim();
  const legs = another && another.toLowerCase() !== primaryDestination.toLowerCase()
    ? [{ destination: primaryDestination, timing }, { destination: another, timing: "Next stay" }]
    : [{ destination: primaryDestination, timing }];
  return { destination: primaryDestination, timing, guests, rooms, maxTotalMinor: Math.max(1, Math.round(rupees * 100)), required, preferred, legs };
}
