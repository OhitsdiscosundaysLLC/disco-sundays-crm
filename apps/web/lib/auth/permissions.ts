import { createClient } from "@/lib/supabase/server";
import type { PermissionAction, Resource, UserRole } from "./types";

/**
 * Checks whether `role` can perform `action` on `resource` by calling the
 * database's own public.has_permission() function — the same function RLS
 * policies use — so this check can never drift from what the database
 * actually enforces. This is a defense-in-depth check for the UI/API layer;
 * RLS is still the last line of defense per docs/SECURITY.md.
 */
export async function hasPermission(
  role: UserRole,
  resource: Resource,
  action: PermissionAction
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_permission", {
    p_role: role,
    p_resource: resource,
    p_action: action,
  });

  if (error) {
    console.error("has_permission check failed", error);
    return false;
  }

  return Boolean(data);
}

const NAV_RESOURCES: Resource[] = [
  "customers",
  "leads",
  "bookings",
  "services",
  "projects",
  "galleries",
  "memberships",
  "referrals",
  "rewards",
  "payments",
  "tasks",
  "reports",
  "team",
  "settings",
];

/** Resources `role` may *view*, used to filter navigation. */
export async function getVisibleResources(role: UserRole): Promise<Resource[]> {
  const results = await Promise.all(
    NAV_RESOURCES.map(async (resource) => ({
      resource,
      visible: await hasPermission(role, resource, "view"),
    }))
  );

  return results.filter((r) => r.visible).map((r) => r.resource);
}
