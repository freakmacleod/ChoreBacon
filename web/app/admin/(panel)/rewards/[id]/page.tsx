import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import { requireAdmin } from "@/lib/admin/auth";
import { getReward } from "@/lib/admin/catalog";
import { familyOptions } from "@/lib/admin/families";
import { isUuid } from "@/lib/api";
import { RewardForm } from "../../../_components/forms";
import { PageHeader } from "../../../_components/ui";
import { sv } from "../../../strings";

export default function EditRewardPage({ params }: PageProps<"/admin/rewards/[id]">) {
  return (
    <Suspense fallback={<p>{sv.loading}</p>}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: Pick<PageProps<"/admin/rewards/[id]">, "params">) {
  await requireAdmin();
  const { id } = await params;
  const families = await familyOptions(db);
  if (id === "new")
    return (
      <>
        <PageHeader title={sv.rewards.new} />
        <RewardForm families={families} />
      </>
    );
  const reward = isUuid(id) ? await getReward(db, id) : null;
  if (!reward) notFound();
  return (
    <>
      <PageHeader title={sv.rewards.edit} />
      <RewardForm reward={reward} families={families} />
    </>
  );
}
