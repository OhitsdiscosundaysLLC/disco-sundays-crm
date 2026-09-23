import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const canManagePermissions = await hasPermission(
    profile.role,
    "settings",
    "edit"
  );

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Settings</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Account and workspace configuration.
        </p>
      </div>

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-900">
          Your account
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Name" value={profile.display_name || "—"} />
          <Row label="Email" value={profile.email || "—"} />
          <Row label="Role" value={profile.role} />
          <Row label="Status" value={profile.status} />
        </dl>
      </section>

      {canManagePermissions ? <RolePermissionsTable /> : null}

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-900">
          Integrations
        </h2>
        <p className="mt-2 text-sm text-neutral-500">
          Shopify, Square, and Base44 connection status lands here starting
          Phase 3 — see docs/INTEGRATIONS.md for the current plan.
        </p>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-neutral-100 pb-2 last:border-0 last:pb-0">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-neutral-900">{value}</dd>
    </div>
  );
}

/** Only rendered for roles with settings:edit — read-only for now (editing lands with the rest of Settings in a later Phase 1 increment). */
async function RolePermissionsTable() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("role_permissions")
    .select("role, resource, can_view, can_create, can_edit, can_delete")
    .order("role")
    .order("resource");

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <h2 className="text-sm font-medium text-neutral-900">
        Role permissions
      </h2>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-neutral-500">
              <th className="py-1 pr-4">Role</th>
              <th className="py-1 pr-4">Resource</th>
              <th className="py-1 pr-4">View</th>
              <th className="py-1 pr-4">Create</th>
              <th className="py-1 pr-4">Edit</th>
              <th className="py-1">Delete</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((row) => (
              <tr
                key={`${row.role}-${row.resource}`}
                className="border-t border-neutral-100"
              >
                <td className="py-1 pr-4">{row.role}</td>
                <td className="py-1 pr-4">{row.resource}</td>
                <td className="py-1 pr-4">{row.can_view ? "✓" : ""}</td>
                <td className="py-1 pr-4">{row.can_create ? "✓" : ""}</td>
                <td className="py-1 pr-4">{row.can_edit ? "✓" : ""}</td>
                <td className="py-1">{row.can_delete ? "✓" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
