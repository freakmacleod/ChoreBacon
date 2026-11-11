import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import { requireAdmin } from "@/lib/admin/auth";
import { getChore } from "@/lib/admin/catalog";
import { isUuid } from "@/lib/api";
import { ChoreForm } from "../../../_components/forms";
import { PageHeader } from "../../../_components/ui";
import { sv } from "../../../strings";

export default function EditChorePage({ params }: PageProps<"/admin/chores/[id]">) {
  return (
    <Suspense fallback={<p>{sv.loading}</p>}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: Pick<PageProps<"/admin/chores/[id]">, "params">) {
  await requireAdmin();
  const { id } = await params;
  if (id === "new")
    return (
      <>
        <PageHeader title={sv.chores.new} />
        <ChoreForm />
      </>
    );
  const chore = isUuid(id) ? await getChore(db, id) : null;
  if (!chore) notFound();
  return (
    <>
      <PageHeader title={sv.chores.edit} />
      <ChoreForm chore={chore} />
    </>
  );
}
