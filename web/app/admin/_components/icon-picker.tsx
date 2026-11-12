import { type IconGroup, type IconKind, iconGroupsFor } from "@/lib/icons";
import { sv } from "../strings";

// Icons as a grid of radio tiles, so admins pick a picture instead of typing a key. The item's own
// kind is open; the other kinds are folded away but can be used too.

function Tiles({ group, selected }: { group: IconGroup; selected?: string }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
      {group.icons.map((icon) => (
        <label
          key={icon.key}
          title={icon.key}
          className="flex cursor-pointer flex-col items-center gap-1 rounded border border-zinc-200 p-2 text-center hover:bg-zinc-100 has-[:checked]:border-orange-600 has-[:checked]:bg-orange-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-orange-600 dark:border-zinc-700 dark:hover:bg-zinc-800 dark:has-[:checked]:bg-orange-950"
        >
          <input type="radio" name="icon" value={icon.key} defaultChecked={icon.key === selected} required className="sr-only" />
          <span className="text-2xl" aria-hidden>
            {icon.glyph}
          </span>
          <span className="text-[11px] leading-tight text-zinc-600 dark:text-zinc-400">{icon.label}</span>
        </label>
      ))}
    </div>
  );
}

export function IconPicker({ kind, selected, error }: { kind: IconKind; selected?: string; error?: string }) {
  const [own, ...others] = iconGroupsFor(kind);
  const selectedElsewhere = others.some((group) => group.icons.some((icon) => icon.key === selected));
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{sv.common.icon}</legend>
      <span className="block text-xs text-zinc-500">{sv.common.iconHint}</span>
      <Tiles group={own} selected={selected} />
      <details open={selectedElsewhere} className="space-y-2">
        <summary className="cursor-pointer text-sm text-zinc-600 dark:text-zinc-400">{sv.common.iconMore}</summary>
        {others.map((group) => (
          <div key={group.kind} className="space-y-1 pt-2">
            <div className="text-xs font-medium text-zinc-500">{sv.common.iconGroups[group.kind]}</div>
            <Tiles group={group} selected={selected} />
          </div>
        ))}
      </details>
      {error && <span className="block text-xs text-red-600">{error}</span>}
    </fieldset>
  );
}
