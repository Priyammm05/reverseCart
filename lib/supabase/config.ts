export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export const playwrightUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "playwright@reversecart.test",
  name: "Playwright Buyer",
};
