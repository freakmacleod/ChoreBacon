import Link from "next/link";
import type { ScopeFilter } from "@/lib/admin/catalog";
import { isUuid } from "@/lib/api";
import { sv } from "../strings";
import { inputClass, secondaryButtonClass } from "./ui";

// Global vs family-only items in the catalog lists: a filter (?scope=all|global|<family id>) and the
// "Gäller" cell linking to the family.

export function parseScopeFilter(value: string | string[] | undefined): ScopeFilter {
  if (value === "global") return "global";
  if (typeof value === "string" && isUuid(value)) return { familyId: value };
  return "all";
}

/** A plain GET form, so the filter works without client JavaScript and the URL can be shared. */
export function ScopeFilterBar({ filter, families }: { filter: ScopeFilter; families: { id: string; name: string }[] }) {
  const selected = typeof filter === "string" ? filter : filter.familyId;
  return (
    <form className="mb-4 flex items-center gap-2">
      <label htmlFor="scope" className="text-sm font-medium">
        {sv.common.scope}
      </label>
      <select id="scope" name="scope" defaultValue={selected} className={`${inputClass} max-w-xs`}>
        <option value="all">{sv.common.filterAll}</option>
        <option value="global">{sv.common.filterGlobal}</option>
        {families.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <button type="submit" className={secondaryButtonClass}>
        {sv.common.filterShow}
      </button>
    </form>
  );
}

export function ScopeCell({ familyId, familyName }: { familyId: string | null; familyName: string | null }) {
  if (!familyId) return <span className="text-zinc-500">{sv.common.scopeGlobal}</span>;
  return (
    <Link href={`/admin/families/${familyId}`} className="hover:underline">
      {familyName}
    </Link>
  );
}
