import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { requireAdmin } from "@/lib/admin/auth";
import { listChores } from "@/lib/admin/catalog";
import { setChoreActive } from "../../actions";
import { ActiveToggle } from "../../_components/ActiveToggle";
import { PageHeader, StatusBadge, buttonClass, tableClass } from "../../_components/ui";
import { sv } from "../../strings";

export default function ChoresPage() {
  return (
    <>
      <PageHeader title={sv.chores.title} action={<Link href="/admin/chores/new" className={buttonClass}>{sv.chores.new}</Link>} />
      <p className="mb-4 text-sm text-zinc-500">{sv.common.deactivateHint}</p>
      <Suspense fallback={<p>{sv.loading}</p>}>
        <ChoreTable />
      </Suspense>
    </>
  );
}

async function ChoreTable() {
  await requireAdmin();
  const chores = await listChores(db);
  if (chores.length === 0) return <p>{sv.common.empty}</p>;
  return (
    <table className={tableClass}>
      <thead>
        <tr>
          <th>{sv.common.title}</th>
          <th>{sv.chores.points}</th>
          <th>{sv.chores.frequency}</th>
          <th>{sv.common.icon}</th>
          <th>{sv.common.status}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {chores.map((chore) => (
          <tr key={chore.id} className={chore.isActive ? "" : "text-zinc-400"}>
            <td>
              <Link href={`/admin/chores/${chore.id}`} className="font-medium hover:underline">
                {chore.title}
              </Link>
              {chore.description && <div className="text-xs text-zinc-500">{chore.description}</div>}
            </td>
            <td>{chore.points}</td>
            <td>{sv.chores.frequencies[chore.frequency]}</td>
            <td className="font-mono text-xs">{chore.icon}</td>
            <td>
              <StatusBadge active={chore.isActive} labels={sv.common} />
            </td>
            <td className="text-right">
              <ActiveToggle id={chore.id} active={chore.isActive} action={setChoreActive} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
