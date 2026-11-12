import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { requireAdmin } from "@/lib/admin/auth";
import { listUsers } from "@/lib/admin/catalog";
import { setUserRole } from "../../actions";
import { PageHeader, secondaryButtonClass, tableClass } from "../../_components/ui";
import { familySv, formatDate, sv } from "../../strings";

export default function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <>
      <PageHeader title={sv.users.title} />
      <Suspense fallback={<p>{sv.loading}</p>}>
        <UserTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function UserTable({ searchParams }: Pick<PageProps<"/admin/users">, "searchParams">) {
  const admin = await requireAdmin();
  const { error } = await searchParams;
  const users = await listUsers(db);
  return (
    <>
      {error === "cannot_demote_self" && <p className="mb-4 text-sm text-red-600">{sv.users.cannotDemoteSelf}</p>}
      <table className={tableClass}>
        <thead>
          <tr>
            <th>{sv.users.name}</th>
            <th>{sv.users.provider}</th>
            <th>{sv.users.role}</th>
            <th>{sv.users.family}</th>
            <th>{sv.users.balance}</th>
            <th>{sv.users.lifetime}</th>
            <th>{sv.users.chores}</th>
            <th>{sv.users.created}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                <div className="font-medium">{user.displayName}</div>
                {user.email && <div className="text-xs text-zinc-500">{user.email}</div>}
              </td>
              <td>{user.provider}</td>
              <td>{user.deletedAt ? sv.users.deleted : sv.users.roles[user.role]}</td>
              <td>
                {user.familyId ? (
                  <Link href={`/admin/families/${user.familyId}`} className="hover:underline">
                    {user.familyName} ({familySv.roles[user.familyRole ?? "child"]})
                  </Link>
                ) : (
                  sv.users.noFamily
                )}
              </td>
              <td>{user.balance}</td>
              <td>{user.lifetimeEarned}</td>
              <td>{user.choresCompleted}</td>
              <td className="whitespace-nowrap">{formatDate(user.createdAt)}</td>
              <td className="text-right">
                {user.id !== admin.id && !user.deletedAt && (
                  <form action={setUserRole} className="inline">
                    <input type="hidden" name="id" value={user.id} />
                    <input type="hidden" name="role" value={user.role === "admin" ? "user" : "admin"} />
                    <button type="submit" className={secondaryButtonClass}>
                      {user.role === "admin" ? sv.users.removeAdmin : sv.users.makeAdmin}
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
