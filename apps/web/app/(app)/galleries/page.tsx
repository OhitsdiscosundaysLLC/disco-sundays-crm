import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel, formatDate } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";

export default async function GalleriesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const canView = await hasPermission(profile.role, "galleries", "view");
  if (!canView) {
    return <EmptyState title="No access" description="You don't have permission to view galleries." />;
  }

  const canCreate = await hasPermission(profile.role, "galleries", "create");

  const supabase = await createClient();
  const { data: galleries, error } = await supabase
    .from("galleries")
    .select("id, title, visibility, published, created_at, customers(id, display_name, email, phone)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Galleries</h1>
        {canCreate ? (
          <Link
            href="/galleries/new"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            New gallery
          </Link>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-600">Could not load galleries.</p>
      ) : !galleries || galleries.length === 0 ? (
        <EmptyState
          title="No galleries yet"
          description={
            canCreate ? "Create a gallery to deliver media to a customer." : "Galleries will show up here once they're added."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Visibility</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {galleries.map((gallery) => (
                <tr key={gallery.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-2">
                    <Link href={`/galleries/${gallery.id}`} className="font-medium text-neutral-900 hover:underline">
                      {gallery.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-neutral-600">
                    {gallery.customers ? customerLabel(gallery.customers) : "—"}
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{gallery.visibility}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        gallery.published ? "bg-green-100 text-green-800" : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {gallery.published ? "published" : "draft"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-neutral-500">{formatDate(gallery.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
