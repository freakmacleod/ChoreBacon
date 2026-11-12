import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { db } from "@/db";
import { requireAdmin } from "@/lib/admin/auth";
import { getFamilyDetail, usersWithoutFamily } from "@/lib/admin/families";
import { isUuid } from "@/lib/api";
import { removeFamilyMember, setFamilyMemberRole } from "../../../actions";
import { AddMemberForm, FamilyForm } from "../../../_components/family-forms";
import { PageHeader, StatusBadge, secondaryButtonClass, tableClass } from "../../../_components/ui";
import { familySv, formatDate, sv } from "../../../strings";

export default function FamilyDetailPage({ params, searchParams }: PageProps<"/admin/families/[id]">) {
  return (
    <Suspense fallback={<p>{sv.loading}</p>}>
      <Detail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

/** A one-button form posting a member change to a Server Action. */
function MemberButton({ familyId, userId, action, role, label }: {
  familyId: string;
  userId: string;
  action: (form: FormData) => Promise<void>;
  role?: string;
  label: string;
}) {
  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={familyId} />
      <input type="hidden" name="userId" value={userId} />
      {role && <input type="hidden" name="role" value={role} />}
      <button type="submit" className={secondaryButtonClass}>
        {label}
      </button>
    </form>
  );
}

function Section({ title, empty, children }: { title: string; empty: boolean; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      {empty ? <p className="text-sm text-zinc-500">{familySv.none}</p> : children}
    </section>
  );
}

async function Detail({ params, searchParams }: PageProps<"/admin/families/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (id === "new")
    return (
      <>
        <PageHeader title={familySv.new} />
        <FamilyForm />
      </>
    );
  const detail = isUuid(id) ? await getFamilyDetail(db, id) : null;
  if (!detail) notFound();
  const { family, members, ownChores, ownRewards, ownAchievements, choreChanges, rewardChanges } = detail;
  const { error } = await searchParams;
  const freeUsers = await usersWithoutFamily(db);

  return (
    <>
      <Link href="/admin/families" className="text-sm hover:underline">
        ← {familySv.back}
      </Link>
      <PageHeader title={family.name} />
      <p className="text-sm text-zinc-500">
        {familySv.approval}: {family.requiresApproval ? familySv.on : familySv.off} · {familySv.created} {formatDate(family.createdAt)}
      </p>
      <p className="mt-2 text-sm">
        {familySv.inviteCode}: <span className="font-mono text-base font-semibold">{family.inviteCode}</span>
      </p>
      <p className="text-xs text-zinc-500">{familySv.inviteHint}</p>
      {typeof error === "string" && familySv.errors[error] && <p className="mt-4 text-sm text-red-600">{familySv.errors[error]}</p>}

      <Section title={familySv.memberSection} empty={members.length === 0}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th>{sv.users.name}</th>
              <th>{sv.users.role}</th>
              <th>{sv.users.balance}</th>
              <th>{familySv.joined}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.userId}>
                <td>
                  <div className="font-medium">{m.displayName}</div>
                  {m.email && <div className="text-xs text-zinc-500">{m.email}</div>}
                </td>
                <td>{familySv.roles[m.role]}</td>
                <td>{m.balance}</td>
                <td className="whitespace-nowrap">{formatDate(m.joinedAt)}</td>
                <td className="space-x-2 whitespace-nowrap text-right">
                  <MemberButton
                    familyId={family.id}
                    userId={m.userId}
                    action={setFamilyMemberRole}
                    role={m.role === "parent" ? "child" : "parent"}
                    label={m.role === "parent" ? familySv.makeChild : familySv.makeParent}
                  />
                  <MemberButton familyId={family.id} userId={m.userId} action={removeFamilyMember} label={familySv.remove} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <p className="mt-2 text-xs text-zinc-500">{familySv.removeHint}</p>

      <section className="mt-6 space-y-2">
        <h2 className="text-lg font-semibold">{familySv.addMember}</h2>
        <p className="text-xs text-zinc-500">{familySv.addMemberHint}</p>
        <AddMemberForm familyId={family.id} users={freeUsers} hasParent={members.some((m) => m.role === "parent")} />
      </section>

      <section className="mt-8 space-y-2">
        <h2 className="text-lg font-semibold">{familySv.edit}</h2>
        <FamilyForm family={family} />
      </section>

      <p className="mt-8 text-sm text-zinc-500">{familySv.addItemsHint}</p>

      <Section title={familySv.ownChoresSection} empty={ownChores.length === 0}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th>{sv.common.title}</th>
              <th>{sv.chores.points}</th>
              <th>{sv.chores.frequency}</th>
              <th>{sv.common.status}</th>
            </tr>
          </thead>
          <tbody>
            {ownChores.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/admin/chores/${c.id}`} className="hover:underline">
                    {c.title}
                  </Link>
                </td>
                <td>{c.points}</td>
                <td>{sv.chores.frequencies[c.frequency]}</td>
                <td>
                  <StatusBadge active={c.isActive} labels={sv.common} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={familySv.ownRewardsSection} empty={ownRewards.length === 0}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th>{sv.common.title}</th>
              <th>{sv.rewards.cost}</th>
              <th>{familySv.stock}</th>
              <th>{sv.common.status}</th>
            </tr>
          </thead>
          <tbody>
            {ownRewards.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/admin/rewards/${r.id}`} className="hover:underline">
                    {r.title}
                  </Link>
                </td>
                <td>{r.cost}</td>
                <td>{r.stock ?? familySv.unlimited}</td>
                <td>
                  <StatusBadge active={r.isActive} labels={sv.common} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={familySv.ownAchievementsSection} empty={ownAchievements.length === 0}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th>{sv.common.title}</th>
              <th>{sv.achievements.rule}</th>
              <th>{sv.achievements.threshold}</th>
              <th>{sv.common.status}</th>
            </tr>
          </thead>
          <tbody>
            {ownAchievements.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link href={`/admin/achievements/${a.id}`} className="hover:underline">
                    {a.title}
                  </Link>
                </td>
                <td>{sv.achievements.rules[a.ruleType]}</td>
                <td>{a.threshold}</td>
                <td>
                  <StatusBadge active={a.isActive} labels={sv.common} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={familySv.choreChangesSection} empty={choreChanges.length === 0}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th>{sv.common.title}</th>
              <th>{familySv.shown}</th>
              <th>
                {sv.chores.points} ({familySv.catalogValue} → {familySv.familyValue})
              </th>
            </tr>
          </thead>
          <tbody>
            {choreChanges.map((c) => (
              <tr key={c.choreId}>
                <td>{c.title}</td>
                <td>{c.isActive ? familySv.shown : familySv.hidden}</td>
                <td>
                  {c.catalogPoints} → {c.pointsOverride ?? c.catalogPoints}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={familySv.rewardChangesSection} empty={rewardChanges.length === 0}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th>{sv.common.title}</th>
              <th>{familySv.shown}</th>
              <th>
                {sv.rewards.cost} ({familySv.catalogValue} → {familySv.familyValue})
              </th>
              <th>{familySv.stock}</th>
            </tr>
          </thead>
          <tbody>
            {rewardChanges.map((r) => (
              <tr key={r.rewardId}>
                <td>{r.title}</td>
                <td>{r.isActive ? familySv.shown : familySv.hidden}</td>
                <td>
                  {r.catalogCost} → {r.costOverride ?? r.catalogCost}
                </td>
                <td>{r.stock ?? familySv.unlimited}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}
