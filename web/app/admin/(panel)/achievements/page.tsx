import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { requireAdmin } from "@/lib/admin/auth";
import { listAchievements } from "@/lib/admin/catalog";
import { familyOptions } from "@/lib/admin/families";
import { iconGlyph } from "@/lib/icons";
import { setAchievementActive } from "../../actions";
import { ActiveToggle } from "../../_components/ActiveToggle";
import { ScopeCell, ScopeFilterBar, parseScopeFilter } from "../../_components/scope";
import { PageHeader, StatusBadge, buttonClass, tableClass } from "../../_components/ui";
import { sv } from "../../strings";

export default function AchievementsPage({ searchParams }: PageProps<"/admin/achievements">) {
  return (
    <>
      <PageHeader
        title={sv.achievements.title}
        action={<Link href="/admin/achievements/new" className={buttonClass}>{sv.achievements.new}</Link>}
      />
      <p className="mb-1 text-sm text-zinc-500">{sv.common.achievementsHint}</p>
      <p className="mb-4 text-sm text-zinc-500">{sv.common.deactivateHint}</p>
      <Suspense fallback={<p>{sv.loading}</p>}>
        <AchievementTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function AchievementTable({ searchParams }: Pick<PageProps<"/admin/achievements">, "searchParams">) {
  await requireAdmin();
  const filter = parseScopeFilter((await searchParams).scope);
  const [achievements, families] = await Promise.all([listAchievements(db, filter), familyOptions(db)]);
  return (
    <>
      <ScopeFilterBar filter={filter} families={families} />
      {achievements.length === 0 ? <p>{sv.common.empty}</p> : <AchievementTableRows achievements={achievements} />}
    </>
  );
}

function AchievementTableRows({ achievements }: { achievements: Awaited<ReturnType<typeof listAchievements>> }) {
  return (
    <table className={tableClass}>
      <thead>
        <tr>
          <th>{sv.common.title}</th>
          <th>{sv.common.scope}</th>
          <th>{sv.achievements.rule}</th>
          <th>{sv.achievements.threshold}</th>
          <th>{sv.achievements.bonus}</th>
          <th>{sv.achievements.rarity}</th>
          <th>{sv.common.icon}</th>
          <th>{sv.common.status}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {achievements.map((a) => (
          <tr key={a.id} className={a.isActive ? "" : "text-zinc-400"}>
            <td>
              <Link href={`/admin/achievements/${a.id}`} className="font-medium hover:underline">
                {a.title}
              </Link>
              <div className="font-mono text-xs text-zinc-500">{a.code}</div>
            </td>
            <td>
              <ScopeCell familyId={a.familyId} familyName={a.familyName} />
            </td>
            <td>{sv.achievements.rules[a.ruleType]}</td>
            <td>{a.threshold}</td>
            <td>{a.bonusPoints}</td>
            <td>{sv.achievements.rarities[a.rarity]}</td>
            <td className="text-xl" title={a.icon}>
              {iconGlyph(a.icon)}
            </td>
            <td>
              <StatusBadge active={a.isActive} labels={sv.common} />
            </td>
            <td className="text-right">
              <ActiveToggle id={a.id} active={a.isActive} action={setAchievementActive} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
