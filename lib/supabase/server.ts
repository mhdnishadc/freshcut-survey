import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * `cookies()` is async in Next.js 16, so this must be awaited. Server
 * Components are not allowed to write cookies; the `setAll` swallow below is
 * the documented pattern — `proxy.ts` refreshes the session instead.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // proxy.ts keeps the session fresh, so this is safe to ignore.
          }
        },
      },
    },
  );
}

/**
 * The signed-in user, or null. Every page and Server Action calls this itself
 * rather than trusting the proxy — Server Actions are POSTs to the page route
 * and a matcher change could silently drop proxy coverage.
 */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
