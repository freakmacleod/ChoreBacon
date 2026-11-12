import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import { requireAdmin } from "@/lib/admin/auth";
import { getAchievement } from "@/lib/admin/catalog";
import { familyOptions } from "@/lib/admin/families";
import { isUuid } from "@/lib/api";
import { AchievementForm } from "../../../_components/forms";
import { PageHeader } from "../../../_components/ui";
import { sv } from "../../../strings";

export default function EditAchievementPage({ params }: PageProps<"/admin/achievements/[id]">) {
  return (
    <Suspense fallback={<p>{sv.loading}</p>}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: Pick<PageProps<"/admin/achievements/[id]">, "params">) {
  await requireAdmin();
  const { id } = await params;
  const families = await familyOptions(db);
  if (id === "new")
    return (
      <>
        <PageHeader title={sv.achievements.new} />
        <AchievementForm families={families} />
      </>
    );
  const achievement = isUuid(id) ? await getAchievement(db, id) : null;
  if (!achievement) notFound();
  return (
    <>
      <PageHeader title={sv.achievements.edit} />
      <AchievementForm achievement={achievement} families={families} />
    </>
  );
}
