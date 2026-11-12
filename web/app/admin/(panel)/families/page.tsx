import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { requireAdmin } from "@/lib/admin/auth";
import { listFamilies } from "@/lib/admin/families";
import { PageHeader, buttonClass, tableClass } from "../../_components/ui";
import { familySv, formatDate, sv } from "../../strings";

export default function FamiliesPage() {
  return (
    <>
      <PageHeader
        title={familySv.title}
        action={
          <Link href="/admin/families/new" className={buttonClass}>
            {familySv.new}
          </Link>
        }
      />
      <p className="mb-4 text-sm text-zinc-500">{familySv.intro}</p>
      <Suspense fallback={<p>{sv.loading}</p>}>
        <FamilyTable />
      </Suspense>
    </>
  );
}

async function FamilyTable() {
  await requireAdmin();
  const families = await listFamilies(db);
  if (families.length === 0) return <p>{familySv.empty}</p>;
  return (
    <table className={tableClass}>
      <thead>
        <tr>
          <th>{familySv.name}</th>
          <th>{familySv.parents}</th>
          <th>{familySv.members}</th>
          <th>{familySv.approval}</th>
          <th>{familySv.ownChores}</th>
          <th>{familySv.ownRewards}</th>
          <th>{familySv.changes}</th>
          <th>{familySv.created}</th>
        </tr>
      </thead>
      <tbody>
        {families.map((f) => (
          <tr key={f.id}>
            <td>
              <Link href={`/admin/families/${f.id}`} className="font-medium hover:underline">
                {f.name}
              </Link>
            </td>
            <td>{f.parents || "–"}</td>
            <td>{f.members}</td>
            <td>{f.requiresApproval ? familySv.on : familySv.off}</td>
            <td>{f.ownChores}</td>
            <td>{f.ownRewards}</td>
            <td>{f.changes}</td>
            <td className="whitespace-nowrap">{formatDate(f.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
