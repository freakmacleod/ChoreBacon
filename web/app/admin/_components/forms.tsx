"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { IconKind } from "@/lib/icons";
import { type FormState, saveAchievement, saveChore, saveReward } from "../actions";
import { sv } from "../strings";
import { IconPicker } from "./icon-picker";
import { Field, buttonClass, inputClass, secondaryButtonClass } from "./ui";

/** Scope of an existing item: null family = global. */
type Scoped = { familyId: string | null; familyName: string | null };
type Chore = Scoped & { id: string; title: string; description: string; icon: string; points: number; frequency: string; isActive: boolean };
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
export type FamilyOption = { id: string; name: string };

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
  return (
    <form action={action} className="max-w-lg space-y-4">
      <input type="hidden" name="id" value={chore?.id ?? ""} />
      <ScopeField item={chore} families={families} error={state.errors?.scope} />
      <Common kind="chore" item={chore} errors={state.errors} />
      <Field label={sv.chores.points} name="points" error={state.errors?.points}>
        <input id="points" name="points" type="number" min={1} defaultValue={chore?.points ?? 10} required className={inputClass} />
      </Field>
      <Field label={sv.chores.frequency} name="frequency" error={state.errors?.frequency}>
        <select id="frequency" name="frequency" defaultValue={chore?.frequency ?? "daily"} className={inputClass}>
          {options(sv.chores.frequencies)}
        </select>
      </Field>
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
