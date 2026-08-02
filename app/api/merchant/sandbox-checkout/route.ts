import { NextResponse } from "next/server";

export const runtime = "nodejs";

type CheckoutBody = {
  amount?: string;
  currency?: string;
  card?: {
    number?: string;
    cvv?: string;
    expMonth?: string;
    expYear?: string;
  };
};

function authorized(request: Request) {
  const expected = process.env.REVERSECART_MERCHANT_CHECKOUT_KEY;
  const supplied = request.headers.get("authorization");
  return Boolean(expected && supplied === `Bearer ${expected}`);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized merchant checkout." }, { status: 401 });
  }

  const body = (await request.json()) as CheckoutBody;
  const amount = Number(body.amount);
  const card = body.card;
  if (
    body.currency !== "INR" ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 500000 ||
    !card?.number ||
    !card.cvv ||
    !card.expMonth ||
    !card.expYear
  ) {
    return NextResponse.json({ error: "Invalid sandbox checkout payload." }, { status: 400 });
  }

  // Hackathon merchant simulator: validates Prava's scoped credential shape but
  // deliberately performs no network charge and never persists card data.
  return NextResponse.json({
    approved: true,
    authorizationCode: `SANDBOX-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    responseCode: "00",
    transactionId: `sandbox_${crypto.randomUUID()}`,
    simulated: true,
  }, { headers: { "Cache-Control": "no-store" } });
}
