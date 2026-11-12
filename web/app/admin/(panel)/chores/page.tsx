import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { requireAdmin } from "@/lib/admin/auth";
import { listChores } from "@/lib/admin/catalog";
import { familyOptions } from "@/lib/admin/families";
import { iconGlyph } from "@/lib/icons";
import { setChoreActive } from "../../actions";
import { ActiveToggle } from "../../_components/ActiveToggle";
import { ScopeCell, ScopeFilterBar, parseScopeFilter } from "../../_components/scope";
import { PageHeader, StatusBadge, buttonClass, tableClass } from "../../_components/ui";
import { sv } from "../../strings";

export default function ChoresPage({ searchParams }: PageProps<"/admin/chores">) {
  return (
    <>
      <PageHeader title={sv.chores.title} action={<Link href="/admin/chores/new" className={buttonClass}>{sv.chores.new}</Link>} />
      <p className="mb-1 text-sm text-zinc-500">{sv.common.globalHint}</p>
      <p className="mb-4 text-sm text-zinc-500">{sv.common.deactivateHint}</p>
      <Suspense fallback={<p>{sv.loading}</p>}>
        <ChoreTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ChoreTable({ searchParams }: Pick<PageProps<"/admin/chores">, "searchParams">) {
  await requireAdmin();
  const filter = parseScopeFilter((await searchParams).scope);
  const [chores, families] = await Promise.all([listChores(db, filter), familyOptions(db)]);
  return (
    <>
      <ScopeFilterBar filter={filter} families={families} />
      {chores.length === 0 ? <p>{sv.common.empty}</p> : <ChoreTableRows chores={chores} />}
    </>
  );
}

function ChoreTableRows({ chores }: { chores: Awaited<ReturnType<typeof listChores>> }) {
  return (
    <table className={tableClass}>
      <thead>
        <tr>
          <th>{sv.common.title}</th>
          <th>{sv.common.scope}</th>
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
            <td>
              <ScopeCell familyId={chore.familyId} familyName={chore.familyName} />
            </td>
            <td>{chore.points}</td>
            <td>{sv.chores.frequencies[chore.frequency]}</td>
            <td className="text-xl" title={chore.icon}>
              {iconGlyph(chore.icon)}
            </td>
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
