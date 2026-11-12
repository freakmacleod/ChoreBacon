import Link from "next/link";

// Public pages (home, privacy policy, account deletion). Static, in Swedish.
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-col bg-orange-50/40 dark:bg-zinc-950">
      <header className="border-b border-orange-100 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
          <Link href="/" className="text-base font-semibold text-orange-600">
            ChoreBacon
          </Link>
          <Link href="/integritet" className="hover:underline">
            Integritetspolicy
          </Link>
          <Link href="/radera-konto" className="hover:underline">
            Radera konto
          </Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">{children}</main>
      <footer className="border-t border-orange-100 px-4 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800">
        ChoreBacon · Kontakt: <a href="mailto:arto@ictor.se" className="underline">arto@ictor.se</a>
      </footer>
    </div>
  );
}
