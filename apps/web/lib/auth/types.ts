export type UserRole =
  | "owner"
  | "admin"
  | "manager"
  | "staff"
  | "photographer"
  | "engineer"
  | "finance"
  | "marketing";

/** Must match the `resource` values seeded in role_permissions (0001_foundation.sql). */
export type Resource =
  | "customers"
  | "leads"
  | "bookings"
  | "services"
  | "projects"
  | "galleries"
  | "memberships"
  | "referrals"
  | "rewards"
  | "payments"
  | "tasks"
  | "reports"
  | "team"
  | "settings";

export type PermissionAction = "view" | "create" | "edit" | "delete";
