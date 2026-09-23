import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { archiveService } from "./actions";

export default async function ServicesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const canView = await hasPermission(profile.role, "services", "view");
  if (!canView) {
    return <EmptyState title="No access" description="You don't have permission to view services." />;
  }

  const [canCreate, canEdit, canDelete] = await Promise.all([
    hasPermission(profile.role, "services", "create"),
    hasPermission(profile.role, "services", "edit"),
    hasPermission(profile.role, "services", "delete"),
  ]);

  const supabase = await createClient();
  const { data: services, error } = await supabase
    .from("services")
    .select("id, name, category, price, duration_minutes, active")
    .is("deleted_at", null)
    .order("name");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Services</h1>
        {canCreate ? (
          <Link
            href="/services/new"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            New service
          </Link>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-600">Could not load services.</p>
      ) : !services || services.length === 0 ? (
        <EmptyState
          title="No services yet"
          description={
            canCreate
              ? "Add your first service to build the catalog."
              : "The service catalog will show up here once it's built."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Price</th>
                <th className="px-4 py-2 font-medium">Duration</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {services.map((service) => (
                <tr key={service.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-2 font-medium text-neutral-900">{service.name}</td>
                  <td className="px-4 py-2 text-neutral-600">{service.category || "—"}</td>
                  <td className="px-4 py-2 text-neutral-600">
                    {service.price !== null ? `$${service.price.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-neutral-600">
                    {service.duration_minutes ? `${service.duration_minutes} min` : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        service.active ? "bg-green-100 text-green-800" : "bg-neutral-100 text-neutral-500"
                      }`}
                    >
                      {service.active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-3">
                      {canEdit ? (
                        <Link href={`/services/${service.id}/edit`} className="text-neutral-500 hover:text-neutral-900">
                          Edit
                        </Link>
                      ) : null}
                      {canDelete ? (
                        <form action={archiveService.bind(null, service.id)}>
                          <SubmitButton
                            pendingLabel="…"
                            className="text-neutral-500 hover:text-red-600"
                          >
                            Archive
                          </SubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
