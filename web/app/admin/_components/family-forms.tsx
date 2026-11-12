"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type FormState, addFamilyMember, saveFamily } from "../actions";
import { familySv, sv } from "../strings";
import { Field, buttonClass, inputClass, secondaryButtonClass } from "./ui";

type Family = { id: string; name: string; requiresApproval: boolean };
type User = { id: string; displayName: string; email: string | null; provider: string };

export function FamilyForm({ family }: { family?: Family }) {
  const [state, action, pending] = useActionState(saveFamily, {});
  return (
    <form action={action} className="max-w-lg space-y-4">
      <input type="hidden" name="id" value={family?.id ?? ""} />
      <Field label={familySv.nameLabel} name="name" error={state.errors?.name}>
        <input id="name" name="name" defaultValue={family?.name} required maxLength={60} className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="requiresApproval" defaultChecked={family?.requiresApproval ?? false} />
        {familySv.requiresApproval}
      </label>
      {state.errors?.form && <p className="text-sm text-red-600">{state.errors.form}</p>}
      <div className="flex gap-2">
        <button type="submit" className={buttonClass} disabled={pending}>
          {sv.common.save}
        </button>
        {!family && (
          <Link href="/admin/families" className={secondaryButtonClass}>
            {sv.common.cancel}
          </Link>
        )}
      </div>
    </form>
  );
}

export function AddMemberForm({ familyId, users, hasParent }: { familyId: string; users: User[]; hasParent: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addFamilyMember, {});
  if (users.length === 0) return <p className="text-sm text-zinc-500">{familySv.noFreeUsers}</p>;
  return (
    <form action={action} className="flex max-w-2xl flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={familyId} />
      <div className="min-w-60 flex-1">
        <Field label={familySv.user} name="userId" error={state.errors?.userId}>
          <select id="userId" name="userId" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              {familySv.chooseUser}
            </option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
                {u.email ? ` (${u.email})` : ` (${u.provider})`}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={familySv.role} name="role" error={state.errors?.role}>
        {/* The first member is usually the parent. */}
        <select id="role" name="role" defaultValue={hasParent ? "child" : "parent"} className={inputClass}>
          <option value="parent">{familySv.roles.parent}</option>
          <option value="child">{familySv.roles.child}</option>
        </select>
      </Field>
      <button type="submit" className={buttonClass} disabled={pending}>
        {familySv.add}
      </button>
      {state.errors?.form && <p className="w-full text-sm text-red-600">{state.errors.form}</p>}
    </form>
  );
}
