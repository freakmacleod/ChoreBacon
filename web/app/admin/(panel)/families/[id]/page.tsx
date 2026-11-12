import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { db } from "@/db";
import { requireAdmin } from "@/lib/admin/auth";
import { getFamilyDetail } from "@/lib/admin/families";
import { isUuid } from "@/lib/api";
import { PageHeader, StatusBadge, tableClass } from "../../../_components/ui";
import { familySv, formatDate, sv } from "../../../strings";

export default function FamilyDetailPage({ params }: PageProps<"/admin/families/[id]">) {
  return (
    <Suspense fallback={<p>{sv.loading}</p>}>
      <Detail params={params} />
    </Suspense>
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

async function Detail({ params }: Pick<PageProps<"/admin/families/[id]">, "params">) {
  await requireAdmin();
  const { id } = await params;
  const detail = isUuid(id) ? await getFamilyDetail(db, id) : null;
  if (!detail) notFound();
  const { family, members, ownChores, ownRewards, choreChanges, rewardChanges } = detail;

  return (
    <>
      <Link href="/admin/families" className="text-sm hover:underline">
        ← {familySv.back}
      </Link>
      <PageHeader title={family.name} />
      <p className="text-sm text-zinc-500">
        {familySv.approval}: {family.requiresApproval ? familySv.on : familySv.off} · {familySv.created} {formatDate(family.createdAt)}
      </p>

      <Section title={familySv.memberSection} empty={members.length === 0}>
        <table className={tableClass}>
          <thead>
            <tr>
              <th>{sv.users.name}</th>
              <th>{sv.users.role}</th>
              <th>{sv.users.balance}</th>
              <th>{familySv.joined}</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

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
                <td>{c.title}</td>
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
                <td>{r.title}</td>
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
