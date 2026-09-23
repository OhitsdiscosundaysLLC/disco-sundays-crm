import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { leadLabel } from "@/lib/format";
import { SubmitButton } from "@/components/submit-button";
import { LeadForm } from "../lead-form";
import { convertLead, deleteLead, updateLead } from "../actions";

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const canView = await hasPermission(profile.role, "leads", "view");
  if (!canView) redirect("/leads");

  const [canEdit, canDelete, canCreateCustomers] = await Promise.all([
    hasPermission(profile.role, "leads", "edit"),
    hasPermission(profile.role, "leads", "delete"),
    hasPermission(profile.role, "customers", "create"),
  ]);

  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: lead }, { data: statuses }, { data: staff }] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).single(),
    supabase.from("lead_statuses").select("slug, label").order("sort_order"),
    supabase.from("profiles").select("id, display_name, email").order("display_name"),
  ]);

  if (!lead || lead.deleted_at) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <h1 className="text-xl font-semibold text-neutral-900">{leadLabel(lead)}</h1>
        <div className="flex shrink-0 gap-2">
          {lead.converted_customer_id ? (
            <Link
              href={`/customers/${lead.converted_customer_id}`}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              View customer
            </Link>
          ) : canEdit && canCreateCustomers ? (
            <form action={convertLead.bind(null, lead.id)}>
              <SubmitButton
                pendingLabel="Converting…"
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Convert to customer
              </SubmitButton>
            </form>
          ) : null}
          {canDelete ? (
            <form action={deleteLead.bind(null, lead.id)}>
              <SubmitButton
                pendingLabel="Deleting…"
                className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
              >
                Delete
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </div>

      {canEdit ? (
        <LeadForm
          action={updateLead}
          submitLabel="Save changes"
          statusOptions={(statuses ?? []).map((s) => ({ value: s.slug, label: s.label }))}
          staffOptions={(staff ?? []).map((p) => ({ value: p.id, label: p.display_name || p.email || p.id }))}
          defaults={lead}
        />
      ) : (
        <dl className="rounded-lg border border-neutral-200 p-4 text-sm">
          <Row label="Email" value={lead.email} />
          <Row label="Phone" value={lead.phone} />
          <Row label="Status" value={statuses?.find((s) => s.slug === lead.status)?.label ?? lead.status} />
          <Row label="Source" value={lead.source} />
          <Row label="Service interest" value={lead.service_interest} />
          <Row label="Notes" value={lead.notes} />
        </dl>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-100 py-2 last:border-0">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right text-neutral-900">{value || "—"}</dd>
    </div>
  );
}
