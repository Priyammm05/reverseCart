import { NextResponse } from "next/server";

export async function GET() {
  const checks = {
    secretKey: Boolean(process.env.PRAVA_SECRET_KEY),
    publicCallback: Boolean(process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://")),
    merchantIdentity: Boolean(process.env.REVERSECART_MERCHANT_URL?.startsWith("https://")),
    merchantCheckout: Boolean(process.env.REVERSECART_MERCHANT_CHECKOUT_URL?.startsWith("https://")),
  };
  return NextResponse.json({
    mode: Object.values(checks).every(Boolean) ? "prava" : "demo",
    checks,
  }, { headers: { "Cache-Control": "no-store" } });
}
