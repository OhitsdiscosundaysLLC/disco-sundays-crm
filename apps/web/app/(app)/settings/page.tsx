import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { SubmitButton } from "@/components/submit-button";
import { testSquareConnection, testShopifyConnection } from "./integrations-actions";

const TEST_ACTIONS: Record<string, (() => Promise<void>) | undefined> = {
  square: testSquareConnection,
  shopify: testShopifyConnection,
};

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

      <IntegrationsSection canManage={canManagePermissions} />
    </div>
  );
}

async function IntegrationsSection({ canManage }: { canManage: boolean }) {
  const supabase = await createClient();
  const { data: integrations } = await supabase
    .from("integrations")
    .select("provider, status, last_checked_at, metadata")
    .order("provider");

  const STATUS_STYLES: Record<string, string> = {
    connected: "bg-green-100 text-green-800",
    error: "bg-red-100 text-red-700",
    not_connected: "bg-neutral-100 text-neutral-500",
  };

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <h2 className="text-sm font-medium text-neutral-900">Integrations</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Connection status only — no secrets are stored or shown here.
      </p>
      <ul className="mt-3 divide-y divide-neutral-100">
        {(integrations ?? []).map((integration) => (
          <li key={integration.provider} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm font-medium capitalize text-neutral-900">{integration.provider}</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {integration.last_checked_at
                  ? `Last checked ${formatDateTime(integration.last_checked_at)}`
                  : "Never checked"}
                {integration.metadata && typeof integration.metadata === "object"
                  ? renderMetadata(integration.provider, integration.metadata as Record<string, unknown>)
                  : null}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[integration.status] ?? STATUS_STYLES.not_connected}`}>
                {integration.status.replace("_", " ")}
              </span>
              {canManage && TEST_ACTIONS[integration.provider] ? (
                <form action={TEST_ACTIONS[integration.provider]}>
                  <SubmitButton
                    pendingLabel="Checking…"
                    className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs hover:bg-neutral-50"
                  >
                    Test connection
                  </SubmitButton>
                </form>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function renderMetadata(provider: string, metadata: Record<string, unknown>) {
  if (typeof metadata.error === "string") return ` · ${metadata.error}`;

  if (provider === "square" && typeof metadata.location_count === "number") {
    const found = metadata.configured_location_found;
    return ` · ${metadata.location_count} location${metadata.location_count === 1 ? "" : "s"}${
      found === false ? " (configured SQUARE_LOCATION_ID not found)" : ""
    }`;
  }

  if (provider === "shopify" && typeof metadata.shop_name === "string") {
    return ` · ${metadata.shop_name}`;
  }

  return null;
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
