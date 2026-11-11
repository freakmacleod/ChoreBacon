import { connection } from "next/server";
import { Suspense } from "react";
import { isDevLoginEnabled } from "@/lib/auth/config";
import { devAdminLogin } from "../actions";
import { buttonClass, secondaryButtonClass } from "../_components/ui";
import { sv } from "../strings";

// The buttons start the same OAuth flow as the app, marked as an admin sign-in.
export default function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-xl font-semibold">{sv.login.title}</h1>
      <Suspense fallback={null}>
        <LoginError searchParams={searchParams} />
      </Suspense>
      <a href="/api/v1/auth/google/start?client=admin" className={`${buttonClass} text-center`}>
        {sv.login.google}
      </a>
      <a href="/api/v1/auth/facebook/start?client=admin" className={`${buttonClass} bg-blue-600 text-center hover:bg-blue-700`}>
        {sv.login.facebook}
      </a>
      <Suspense fallback={null}>
        <DevLogin />
      </Suspense>
    </main>
  );
}

async function LoginError({ searchParams }: Pick<PageProps<"/admin/login">, "searchParams">) {
  const { error } = await searchParams;
  if (typeof error !== "string") return null;
  return <p className="text-sm text-red-600">{sv.login.errors[error] ?? sv.login.errors.provider_error}</p>;
}

async function DevLogin() {
  // Evaluated per request so a preview with ALLOW_DEV_LOGIN shows it and production never does.
  await connection();
  if (!isDevLoginEnabled()) return null;
  return (
    <form action={devAdminLogin}>
      <button type="submit" className={`${secondaryButtonClass} w-full`}>
        {sv.login.dev}
      </button>
    </form>
  );
}
