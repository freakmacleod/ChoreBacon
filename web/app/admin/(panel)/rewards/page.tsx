import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { requireAdmin } from "@/lib/admin/auth";
import { listRewards } from "@/lib/admin/catalog";
import { iconGlyph } from "@/lib/icons";
import { setRewardActive } from "../../actions";
import { ActiveToggle } from "../../_components/ActiveToggle";
import { PageHeader, StatusBadge, buttonClass, tableClass } from "../../_components/ui";
import { sv } from "../../strings";

export default function RewardsPage() {
  return (
    <>
      <PageHeader title={sv.rewards.title} action={<Link href="/admin/rewards/new" className={buttonClass}>{sv.rewards.new}</Link>} />
      <p className="mb-1 text-sm text-zinc-500">{sv.common.globalHint}</p>
      <p className="mb-4 text-sm text-zinc-500">{sv.common.deactivateHint}</p>
      <Suspense fallback={<p>{sv.loading}</p>}>
        <RewardTable />
      </Suspense>
    </>
  );
}

async function RewardTable() {
  await requireAdmin();
  const rewards = await listRewards(db);
  if (rewards.length === 0) return <p>{sv.common.empty}</p>;
  return (
    <table className={tableClass}>
      <thead>
        <tr>
          <th>{sv.common.title}</th>
          <th>{sv.rewards.cost}</th>
          <th>{sv.common.icon}</th>
          <th>{sv.common.status}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rewards.map((reward) => (
          <tr key={reward.id} className={reward.isActive ? "" : "text-zinc-400"}>
            <td>
              <Link href={`/admin/rewards/${reward.id}`} className="font-medium hover:underline">
                {reward.title}
              </Link>
              {reward.description && <div className="text-xs text-zinc-500">{reward.description}</div>}
            </td>
            <td>{reward.cost}</td>
            <td className="text-xl" title={reward.icon}>
              {iconGlyph(reward.icon)}
            </td>
            <td>
              <StatusBadge active={reward.isActive} labels={sv.common} />
            </td>
            <td className="text-right">
              <ActiveToggle id={reward.id} active={reward.isActive} action={setRewardActive} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
