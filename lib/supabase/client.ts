import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components. Uses the anon key, which is public by
 * design — every table is guarded by Row Level Security, so this key alone
 * grants nothing until a user signs in.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
