"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type FormState, saveAchievement, saveChore, saveReward } from "../actions";
import { sv } from "../strings";
import { Field, buttonClass, inputClass, secondaryButtonClass } from "./ui";

type Chore = { id: string; title: string; description: string; icon: string; points: number; frequency: string; isActive: boolean };
type Reward = { id: string; title: string; description: string; icon: string; cost: number; isActive: boolean };
type Achievement = {
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

function Common({ item, errors }: { item?: { title: string; description: string; icon: string; isActive: boolean }; errors: FormState["errors"] }) {
  return (
    <>
      <Field label={sv.common.title} name="title" error={errors?.title}>
        <input id="title" name="title" defaultValue={item?.title} required maxLength={100} className={inputClass} />
      </Field>
      <Field label={sv.common.description} name="description" error={errors?.description}>
        <textarea id="description" name="description" defaultValue={item?.description} maxLength={500} rows={2} className={inputClass} />
      </Field>
      <Field label={sv.common.icon} name="icon" error={errors?.icon}>
        <input id="icon" name="icon" defaultValue={item?.icon} required pattern="[a-z0-9_]{1,40}" className={inputClass} />
      </Field>
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

export function ChoreForm({ chore }: { chore?: Chore }) {
  const [state, action, pending] = useActionState(saveChore, {});
  return (
    <form action={action} className="max-w-lg space-y-4">
      <input type="hidden" name="id" value={chore?.id ?? ""} />
      <Common item={chore} errors={state.errors} />
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

export function RewardForm({ reward }: { reward?: Reward }) {
  const [state, action, pending] = useActionState(saveReward, {});
  return (
    <form action={action} className="max-w-lg space-y-4">
      <input type="hidden" name="id" value={reward?.id ?? ""} />
      <Common item={reward} errors={state.errors} />
      <Field label={sv.rewards.cost} name="cost" error={state.errors?.cost}>
        <input id="cost" name="cost" type="number" min={1} defaultValue={reward?.cost ?? 50} required className={inputClass} />
      </Field>
      <p className="text-xs text-zinc-500">{sv.rewards.stockHint}</p>
      <Actions pending={pending} back="/admin/rewards" error={state.errors?.form} />
    </form>
  );
}

export function AchievementForm({ achievement }: { achievement?: Achievement }) {
  const [state, action, pending] = useActionState(saveAchievement, {});
  return (
    <form action={action} className="max-w-lg space-y-4">
      <input type="hidden" name="id" value={achievement?.id ?? ""} />
      <Field label={sv.achievements.code} name="code" error={state.errors?.code}>
        <input id="code" name="code" defaultValue={achievement?.code} required pattern="[a-z0-9_]{1,40}" className={inputClass} />
      </Field>
      <Common item={achievement} errors={state.errors} />
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
