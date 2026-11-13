import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import { requireAdmin } from "@/lib/admin/auth";
import { comboChoreOptions, getCombo } from "@/lib/admin/catalog";
import { familyOptions } from "@/lib/admin/families";
import { isUuid } from "@/lib/api";
import { iconGlyph } from "@/lib/icons";
import { ComboForm } from "../../../_components/forms";
import { PageHeader } from "../../../_components/ui";
import { sv } from "../../../strings";

export default function EditComboPage({ params }: PageProps<"/admin/combos/[id]">) {
  return (
    <Suspense fallback={<p>{sv.loading}</p>}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: Pick<PageProps<"/admin/combos/[id]">, "params">) {
  await requireAdmin();
  const { id } = await params;
  const [families, chores] = await Promise.all([familyOptions(db), comboChoreOptions(db)]);
  const glyphs = Object.fromEntries(chores.map((c) => [c.id, iconGlyph(c.icon)]));
  if (id === "new")
    return (
      <>
        <PageHeader title={sv.combos.new} />
        <ComboForm families={families} chores={chores} glyphs={glyphs} />
      </>
    );
  const combo = isUuid(id) ? await getCombo(db, id) : null;
  if (!combo) notFound();
  return (
    <>
      <PageHeader title={sv.combos.edit} />
      <ComboForm combo={combo} families={families} chores={chores} glyphs={glyphs} />
    </>
  );
}
