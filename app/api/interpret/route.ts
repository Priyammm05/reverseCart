import { NextResponse } from "next/server";
import { interpretRequest } from "@/lib/openai";

export async function POST(request: Request) {
  const body = (await request.json()) as { prompt?: string };
  if (!body.prompt || body.prompt.trim().length < 10) return NextResponse.json({ error: "Describe the stay in a little more detail." }, { status: 400 });
  return NextResponse.json(await interpretRequest(body.prompt.trim()));
}
