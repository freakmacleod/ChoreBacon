import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { requireAdmin } from "@/lib/admin/auth";
import { listCombos } from "@/lib/admin/catalog";
import { familyOptions } from "@/lib/admin/families";
import { iconGlyph } from "@/lib/icons";
import { setComboActive } from "../../actions";
import { ActiveToggle } from "../../_components/ActiveToggle";
import { ScopeCell, ScopeFilterBar, parseScopeFilter } from "../../_components/scope";
import { PageHeader, StatusBadge, buttonClass, tableClass } from "../../_components/ui";
import { sv } from "../../strings";

export default function CombosPage({ searchParams }: PageProps<"/admin/combos">) {
  return (
    <>
      <PageHeader title={sv.combos.title} action={<Link href="/admin/combos/new" className={buttonClass}>{sv.combos.new}</Link>} />
      <p className="mb-1 text-sm text-zinc-500">{sv.combos.intro}</p>
      <p className="mb-4 text-sm text-zinc-500">{sv.common.deactivateHint}</p>
      <Suspense fallback={<p>{sv.loading}</p>}>
        <ComboTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ComboTable({ searchParams }: Pick<PageProps<"/admin/combos">, "searchParams">) {
  await requireAdmin();
  const filter = parseScopeFilter((await searchParams).scope);
  const [combos, families] = await Promise.all([listCombos(db, filter), familyOptions(db)]);
  return (
    <>
      <ScopeFilterBar filter={filter} families={families} />
      {combos.length === 0 ? <p>{sv.common.empty}</p> : <ComboTableRows combos={combos} />}
    </>
  );
}

function ComboTableRows({ combos }: { combos: Awaited<ReturnType<typeof listCombos>> }) {
  return (
    <table className={tableClass}>
      <thead>
        <tr>
          <th>{sv.common.title}</th>
          <th>{sv.common.scope}</th>
          <th>{sv.combos.chores}</th>
          <th>{sv.combos.bonus}</th>
          <th>{sv.combos.period}</th>
          <th>{sv.common.icon}</th>
          <th>{sv.common.status}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {combos.map((combo) => (
          <tr key={combo.id} className={combo.isActive ? "" : "text-zinc-400"}>
            <td>
              <Link href={`/admin/combos/${combo.id}`} className="font-medium hover:underline">
                {combo.title}
              </Link>
              {combo.description && <div className="text-xs text-zinc-500">{combo.description}</div>}
            </td>
            <td>
              <ScopeCell familyId={combo.familyId} familyName={combo.familyName} />
            </td>
            <td>
              {combo.chores.map((chore) => (
                <div key={chore.id} className="whitespace-nowrap">
                  {iconGlyph(chore.icon)} {chore.title}
                </div>
              ))}
            </td>
            <td>+{combo.bonusPoints}</td>
            <td>{sv.combos.periods[combo.period]}</td>
            <td className="text-xl" title={combo.icon}>
              {iconGlyph(combo.icon)}
            </td>
            <td>
              <StatusBadge active={combo.isActive} labels={sv.common} />
            </td>
            <td className="text-right">
              <ActiveToggle id={combo.id} active={combo.isActive} action={setComboActive} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
