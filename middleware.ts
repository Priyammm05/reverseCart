import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const withClerk = clerkMiddleware();

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (process.env.PLAYWRIGHT_BYPASS_AUTH === "1") return NextResponse.next();
  return withClerk(request, event);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
