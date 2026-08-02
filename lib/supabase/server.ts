import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { auth, currentUser as clerkCurrentUser } from "@clerk/nextjs/server";
import { isSupabaseConfigured, playwrightUser } from "./config";

export async function createClient() {
  if (!isSupabaseConfigured()) throw new Error("Supabase server configuration is missing.");
  const { getToken } = await auth();
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    accessToken: async () => getToken(),
  });
}

export async function currentUser() {
  if (process.env.PLAYWRIGHT_BYPASS_AUTH === "1") return playwrightUser;
  const user = await clerkCurrentUser();
  if (!user) return null;
  const email = user.primaryEmailAddress?.emailAddress || "";
  return { id: user.id, email, name: user.fullName || user.firstName || email || "Buyer" };
}
