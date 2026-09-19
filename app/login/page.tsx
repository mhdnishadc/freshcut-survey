import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · FreshCut Survey" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams;
  const redirectTo = typeof next === "string" && next.startsWith("/") ? next : "/survey";

  return (
    <main className="flex flex-1 flex-col justify-center px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-2xl">
            🥬
          </div>
          <h1 className="text-xl font-semibold tracking-tight">FreshCut Survey</h1>
          <p className="mt-1 text-sm text-muted">
            Sign in to record hotel interviews and see the results.
          </p>
        </div>

        <LoginForm redirectTo={redirectTo} />

        <p className="mt-6 text-center text-xs text-faint">
          Accounts are created by the team admin in Supabase.
        </p>
      </div>
    </main>
  );
}
