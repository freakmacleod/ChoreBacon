"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { IconKind } from "@/lib/icons";
import { stockholmDateTime } from "@/lib/stockholm-time";
import { type FormState, saveAchievement, saveChore, saveCombo, saveReward } from "../actions";
import { sv } from "../strings";
import { IconPicker } from "./icon-picker";
import { Field, buttonClass, inputClass, secondaryButtonClass } from "./ui";

/** Scope of an existing item: null family = global. */
type Scoped = { familyId: string | null; familyName: string | null };
type Chore = Scoped & {
  id: string;
  title: string;
  description: string;
  icon: string;
  points: number;
  frequency: string;
  expiresAt: Date | null;
  isActive: boolean;
};
type Reward = Scoped & { id: string; title: string; description: string; icon: string; cost: number; stock: number | null; isActive: boolean };
type Achievement = Scoped & {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  ruleType: string;
  threshold: number;
  bonusPoints: number;
  rarity: string;
  isActive: boolean;
};
type Combo = Scoped & {
  id: string;
  title: string;
  description: string;
  icon: string;
  bonusPoints: number;
  period: string;
  choreIds: string[];
  isActive: boolean;
};
export type FamilyOption = { id: string; name: string };
export type ComboChoreOption = { id: string; title: string; icon: string; frequency: string; familyId: string | null; isActive: boolean };

function Actions({ pending, back, error }: { pending: boolean; back: string; error?: string }) {
  return (
    <div className="space-y-2 pt-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className={buttonClass} disabled={pending}>
          {sv.common.save}
        </button>
        <Link href={back} className={secondaryButtonClass}>
          {sv.common.cancel}
        </Link>
      </div>
    </div>
  );
}

/**
 * Global or one family. Picked when the item is created; an existing item only shows its scope, since
 * it never changes.
 */
function ScopeField({
  item,
  families,
  error,
  onChange,
}: {
  item?: Scoped;
  families: FamilyOption[];
  error?: string;
  onChange?: (scope: string) => void;
}) {
  if (item)
    return (
      <p className="text-sm">
        <span className="font-medium">{sv.common.scope}:</span> {item.familyName ?? sv.common.scopeGlobal}{" "}
        <span className="text-xs text-zinc-500">({sv.common.scopeFixed})</span>
      </p>
    );
  return (
    <Field label={sv.common.scope} name="scope" error={error} hint={sv.common.scopeHint}>
      <select id="scope" name="scope" defaultValue="global" className={inputClass} onChange={(e) => onChange?.(e.target.value)}>
        <option value="global">{sv.common.scopeGlobalOption}</option>
        {families.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Common({
  kind,
  item,
  errors,
}: {
  kind: IconKind;
  item?: { title: string; description: string; icon: string; isActive: boolean };
  errors: FormState["errors"];
}) {
  return (
    <>
      <Field label={sv.common.title} name="title" error={errors?.title}>
        <input id="title" name="title" defaultValue={item?.title} required maxLength={100} className={inputClass} />
      </Field>
      <Field label={sv.common.description} name="description" error={errors?.description}>
        <textarea id="description" name="description" defaultValue={item?.description} maxLength={500} rows={2} className={inputClass} />
      </Field>
      <IconPicker kind={kind} selected={item?.icon} error={errors?.icon} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={item?.isActive ?? true} />
        {sv.common.active}
      </label>
    </>
  );
}

const options = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => (
    <option key={value} value={value}>
      {label}
    </option>
  ));

export function ChoreForm({ chore, families }: { chore?: Chore; families: FamilyOption[] }) {
  const [state, action, pending] = useActionState(saveChore, {});
  const [temporary, setTemporary] = useState(Boolean(chore?.expiresAt));
  return (
    <form action={action} className="max-w-lg space-y-4">
      <input type="hidden" name="id" value={chore?.id ?? ""} />
      <ScopeField item={chore} families={families} error={state.errors?.scope} />
      <Common kind="chore" item={chore} errors={state.errors} />
      <Field label={sv.chores.points} name="points" error={state.errors?.points}>
        <input id="points" name="points" type="number" min={1} defaultValue={chore?.points ?? 10} required className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={temporary} onChange={(e) => setTemporary(e.target.checked)} />
        {sv.chores.temporary}
      </label>
      {temporary ? (
        <>
          {/* A temporary chore is always a one-off. */}
          <input type="hidden" name="frequency" value="once" />
          <Field label={sv.chores.deadline} name="expiresAt" error={state.errors?.expiresAt ?? state.errors?.frequency} hint={sv.chores.temporaryHint}>
            <input
              id="expiresAt"
              name="expiresAt"
              type="datetime-local"
              required
              defaultValue={chore?.expiresAt ? stockholmDateTime(chore.expiresAt) : ""}
              className={inputClass}
            />
          </Field>
        </>
      ) : (
        <Field label={sv.chores.frequency} name="frequency" error={state.errors?.frequency}>
          <select id="frequency" name="frequency" defaultValue={chore?.frequency ?? "daily"} className={inputClass}>
            {options(sv.chores.frequencies)}
          </select>
        </Field>
      )}
      <Actions pending={pending} back="/admin/chores" error={state.errors?.form} />
    </form>
  );
}

export function RewardForm({ reward, families }: { reward?: Reward; families: FamilyOption[] }) {
  const [state, action, pending] = useActionState(saveReward, {});
  // Only family rewards have a stock; for a new reward that depends on the scope picked above.
  const [scope, setScope] = useState("global");
  const isFamilyReward = reward ? reward.familyId !== null : scope !== "global";
  return (
    <form action={action} className="max-w-lg space-y-4">
      <input type="hidden" name="id" value={reward?.id ?? ""} />
      <ScopeField item={reward} families={families} error={state.errors?.scope} onChange={setScope} />
      <Common kind="reward" item={reward} errors={state.errors} />
      <Field label={sv.rewards.cost} name="cost" error={state.errors?.cost}>
        <input id="cost" name="cost" type="number" min={1} defaultValue={reward?.cost ?? 50} required className={inputClass} />
      </Field>
      {isFamilyReward ? (
        <Field label={sv.rewards.stock} name="stock" error={state.errors?.stock} hint={sv.rewards.stockFamilyHint}>
          <input id="stock" name="stock" type="number" min={0} defaultValue={reward?.stock ?? ""} className={inputClass} />
        </Field>
      ) : (
        <p className="text-xs text-zinc-500">{sv.rewards.stockHint}</p>
      )}
      <Actions pending={pending} back="/admin/rewards" error={state.errors?.form} />
    </form>
  );
}

export function AchievementForm({ achievement, families }: { achievement?: Achievement; families: FamilyOption[] }) {
  const [state, action, pending] = useActionState(saveAchievement, {});
  return (
    <form action={action} className="max-w-lg space-y-4">
      <input type="hidden" name="id" value={achievement?.id ?? ""} />
      <ScopeField item={achievement} families={families} error={state.errors?.scope} />
      <Field label={sv.achievements.code} name="code" error={state.errors?.code}>
        <input id="code" name="code" defaultValue={achievement?.code} required pattern="[a-z0-9_]{1,40}" className={inputClass} />
      </Field>
      <Common kind="achievement" item={achievement} errors={state.errors} />
      <Field label={sv.achievements.rule} name="ruleType" error={state.errors?.ruleType}>
        <select id="ruleType" name="ruleType" defaultValue={achievement?.ruleType ?? "chores_completed"} className={inputClass}>
          {options(sv.achievements.rules)}
        </select>
      </Field>
      <Field label={sv.achievements.threshold} name="threshold" error={state.errors?.threshold}>
        <input id="threshold" name="threshold" type="number" min={1} defaultValue={achievement?.threshold ?? 1} required className={inputClass} />
      </Field>
      <Field label={sv.achievements.bonus} name="bonusPoints" error={state.errors?.bonusPoints}>
        <input id="bonusPoints" name="bonusPoints" type="number" min={0} defaultValue={achievement?.bonusPoints ?? 0} required className={inputClass} />
      </Field>
      <Field label={sv.achievements.rarity} name="rarity" error={state.errors?.rarity}>
        <select id="rarity" name="rarity" defaultValue={achievement?.rarity ?? "common"} className={inputClass}>
          {options(sv.achievements.rarities)}
        </select>
      </Field>
      <Actions pending={pending} back="/admin/achievements" error={state.errors?.form} />
    </form>
  );
}

export function ComboForm({
  combo,
  families,
  chores,
  glyphs,
}: {
  combo?: Combo;
  families: FamilyOption[];
  chores: ComboChoreOption[];
  /** Icon glyph per chore id, resolved on the server. */
  glyphs: Record<string, string>;
}) {
  const [state, action, pending] = useActionState(saveCombo, {});
  // Which chores fit depends on the scope: picked above for a new combo, fixed for an existing one.
  const [scope, setScope] = useState("global");
  const familyId = combo ? combo.familyId : scope === "global" ? null : scope;
  const selected = new Set(combo?.choreIds);
  const choices = chores.filter(
    (c) => (c.familyId === null || c.familyId === familyId) && (c.isActive || selected.has(c.id)),
  );
  return (
    <form action={action} className="max-w-lg space-y-4">
      <input type="hidden" name="id" value={combo?.id ?? ""} />
      <ScopeField item={combo} families={families} error={state.errors?.scope} onChange={setScope} />
      <Common kind="combo" item={combo} errors={state.errors} />
      <Field label={sv.combos.bonus} name="bonusPoints" error={state.errors?.bonusPoints}>
        <input id="bonusPoints" name="bonusPoints" type="number" min={1} defaultValue={combo?.bonusPoints ?? 20} required className={inputClass} />
      </Field>
      <Field label={sv.combos.period} name="period" error={state.errors?.period}>
        <select id="period" name="period" defaultValue={combo?.period ?? "day"} className={inputClass}>
          {options(sv.combos.periods)}
        </select>
      </Field>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">{sv.combos.chores}</legend>
        <p className="text-xs text-zinc-500">{sv.combos.choresHint}</p>
        {choices.length === 0 && <p className="text-sm">{sv.combos.noChores}</p>}
        <div className="grid gap-1 sm:grid-cols-2">
          {choices.map((chore) => (
            <label key={chore.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="choreIds" value={chore.id} defaultChecked={selected.has(chore.id)} />
              <span aria-hidden>{glyphs[chore.id]}</span>
              <span>
                {chore.title}{" "}
                <span className="text-xs text-zinc-500">
                  ({sv.chores.frequencies[chore.frequency]}
                  {chore.isActive ? "" : `, ${sv.combos.inactiveChore}`})
                </span>
              </span>
            </label>
          ))}
        </div>
        {state.errors?.choreIds && <p className="text-xs text-red-600">{state.errors.choreIds}</p>}
      </fieldset>
      <Actions pending={pending} back="/admin/combos" error={state.errors?.form} />
    </form>
  );
}
