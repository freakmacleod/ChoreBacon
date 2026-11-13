import Link from "next/link";
import { Suspense } from "react";
import { currentAdmin } from "@/lib/admin/auth";
import { logout } from "../actions";
import { sv } from "../strings";

const links = [
  ["/admin/chores", sv.nav.chores],
  ["/admin/combos", sv.nav.combos],
  ["/admin/rewards", sv.nav.rewards],
  ["/admin/achievements", sv.nav.achievements],
  ["/admin/families", sv.nav.families],
  ["/admin/users", sv.nav.users],
] as const;

export default function PanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-semibold text-orange-600">{sv.appName}</span>
          <nav className="flex flex-wrap gap-4 text-sm">
            {links.map(([href, label]) => (
              <Link key={href} href={href} className="hover:underline">
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto text-sm">
            {/* Reads the session cookie, so it streams in behind its own boundary. */}
            <Suspense fallback={null}>
              <AdminBadge />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

async function AdminBadge() {
  const admin = await currentAdmin();
  if (!admin) return null;
  return (
    <form action={logout} className="flex items-center gap-3">
      <span className="text-zinc-500">
        {sv.signedInAs} {admin.displayName}
      </span>
      <button type="submit" className="underline">
        {sv.logout}
      </button>
    </form>
  );
}
