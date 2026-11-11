import type { ReactNode } from "react";

// Small shared building blocks for the admin pages (plain Tailwind, no component library).

export const inputClass =
  "w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
export const buttonClass =
  "rounded bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50";
export const secondaryButtonClass =
  "rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

export function Field({ label, name, error, hint, children }: { label: string; name: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1" htmlFor={name}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
      {error && <span className="block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {action}
    </div>
  );
}

export function StatusBadge({ active, labels }: { active: boolean; labels: { active: string; inactive: string } }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs ${active ? "bg-green-100 text-green-800" : "bg-zinc-200 text-zinc-600"}`}>
      {active ? labels.active : labels.inactive}
    </span>
  );
}

export const tableClass = "w-full text-left text-sm [&_td]:border-t [&_td]:border-zinc-200 [&_td]:px-2 [&_td]:py-2 [&_th]:px-2 [&_th]:py-2 dark:[&_td]:border-zinc-800";
