import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel, formatDate, formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { addNote, addTag, archiveCustomer, deleteNote, removeTag } from "../actions";
import { generateCustomerReferralCode } from "../../referrals/actions";

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const canView = await hasPermission(profile.role, "customers", "view");
  if (!canView) redirect("/customers");

  const [canEdit, canDelete, canViewReferrals, canViewRewards] = await Promise.all([
    hasPermission(profile.role, "customers", "edit"),
    hasPermission(profile.role, "customers", "delete"),
    hasPermission(profile.role, "referrals", "view"),
    hasPermission(profile.role, "rewards", "view"),
  ]);

  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: customer }, { data: tagLinks }, { data: notes }, { data: activities }, referralsResult, rewardResult] =
    await Promise.all([
      supabase.from("customers").select("*").eq("id", id).single(),
      supabase
        .from("customer_tags")
        .select("tag_id, tags(id, name)")
        .eq("customer_id", id),
      supabase
        .from("notes")
        .select("id, body, created_at, author_id, profiles(display_name, email)")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("activities")
        .select("id, type, title, created_at")
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .limit(30),
      canViewReferrals
        ? supabase
            .from("referrals")
            .select("id, qualification_status, created_at, referred:referred_customer_id(id, display_name, email, phone)")
            .eq("referrer_customer_id", id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: null }),
      canViewRewards
        ? supabase.from("reward_accounts").select("balance").eq("customer_id", id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  if (!customer || customer.deleted_at) notFound();

  const referralsMade = referralsResult.data;
  const rewardBalance = rewardResult.data?.balance ?? null;

  const tags = (tagLinks ?? [])
    .map((link) => link.tags)
    .filter((tag): tag is { id: string; name: string } => tag !== null);

  return (
    <div className="max-w-3xl space-y-8">
      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{customerLabel(customer)}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Added {formatDate(customer.created_at)} · {customer.status}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {canEdit ? (
            <Link
              href={`/customers/${customer.id}/edit`}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              Edit
            </Link>
          ) : null}
          {canDelete && customer.status !== "archived" ? (
            <form action={archiveCustomer.bind(null, customer.id)}>
              <SubmitButton
                pendingLabel="Archiving…"
                className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
              >
                Archive
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </div>

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-900">Contact</h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Row label="Email" value={customer.email} />
          <Row label="Phone" value={customer.phone} />
          <Row label="Location" value={customer.location} />
          <Row label="Company" value={customer.company} />
          <Row label="Artist name" value={customer.artist_name} />
          <Row label="Instagram" value={customer.instagram} />
          <Row label="Customer type" value={customer.customer_type} />
          <Row label="Source" value={customer.source} />
          <Row label="Referral source" value={customer.referral_source} />
        </dl>
        {customer.external_square_customer_id || customer.shopify_customer_id || customer.base44_id ? (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
            {customer.external_square_customer_id ? <ExternalBadge label="Square" /> : null}
            {customer.shopify_customer_id ? <ExternalBadge label="Shopify" /> : null}
            {customer.base44_id ? <ExternalBadge label="Base44" /> : null}
          </div>
        ) : null}
      </section>

      {canViewReferrals || canViewRewards ? (
        <section className="rounded-lg border border-neutral-200 p-4">
          <h2 className="text-sm font-medium text-neutral-900">Referrals &amp; Rewards</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {canViewReferrals ? (
              <div className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-2">
                <dt className="text-neutral-500">Referral code</dt>
                <dd className="flex items-center gap-2 text-neutral-900">
                  {customer.referral_code || "—"}
                  {canEdit ? (
                    <form action={generateCustomerReferralCode.bind(null, customer.id)}>
                      <SubmitButton
                        pendingLabel="…"
                        className="text-xs text-neutral-500 underline hover:text-neutral-900"
                      >
                        {customer.referral_code ? "Regenerate" : "Generate"}
                      </SubmitButton>
                    </form>
                  ) : null}
                </dd>
              </div>
            ) : null}
            {canViewRewards ? (
              <div className="flex justify-between gap-4 border-b border-neutral-100 pb-2 last:border-0">
                <dt className="text-neutral-500">Reward balance</dt>
                <dd className="text-neutral-900">{rewardBalance !== null ? `$${rewardBalance}` : "$0"}</dd>
              </div>
            ) : null}
          </dl>
          {canViewReferrals && referralsMade && referralsMade.length > 0 ? (
            <div className="mt-3 border-t border-neutral-100 pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Customers referred</p>
              <ul className="mt-2 space-y-1">
                {referralsMade.map((r) => (
                  <li key={r.id} className="flex justify-between text-sm">
                    <Link href={`/referrals/${r.id}`} className="text-neutral-700 hover:underline">
                      {r.referred ? customerLabel(r.referred) : "—"}
                    </Link>
                    <span className="text-neutral-500">{r.qualification_status}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-900">Tags</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.length === 0 ? <p className="text-sm text-neutral-500">No tags yet.</p> : null}
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700"
            >
              {tag.name}
              {canEdit ? (
                <form action={removeTag.bind(null, customer.id, tag.id, tag.name)}>
                  <button type="submit" aria-label={`Remove ${tag.name}`} className="text-neutral-400 hover:text-neutral-700">
                    ×
                  </button>
                </form>
              ) : null}
            </span>
          ))}
        </div>
        {canEdit ? (
          <form action={addTag.bind(null, customer.id)} className="mt-3 flex gap-2">
            <input
              type="text"
              name="name"
              placeholder="Add a tag"
              required
              className="w-48 rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-neutral-500 focus:outline-none"
            />
            <SubmitButton
              pendingLabel="Adding…"
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
            >
              Add
            </SubmitButton>
          </form>
        ) : null}
      </section>

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-900">Notes</h2>
        <form action={addNote.bind(null, customer.id)} className="mt-3 space-y-2">
          <textarea
            name="body"
            rows={2}
            required
            placeholder="Add a note…"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          />
          <SubmitButton pendingLabel="Saving…" className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50">
            Add note
          </SubmitButton>
        </form>
        <ul className="mt-4 space-y-3">
          {(notes ?? []).map((note) => (
            <li key={note.id} className="border-t border-neutral-100 pt-3 first:border-0 first:pt-0">
              <p className="text-sm text-neutral-800">{note.body}</p>
              <div className="mt-1 flex items-center justify-between text-xs text-neutral-500">
                <span>
                  {note.profiles?.display_name || note.profiles?.email || "Unknown"} ·{" "}
                  {formatDateTime(note.created_at)}
                </span>
                {note.author_id === profile.id || canDelete ? (
                  <form action={deleteNote.bind(null, customer.id, note.id)}>
                    <button type="submit" className="text-neutral-400 hover:text-red-600">
                      Delete
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium text-neutral-900">Timeline</h2>
        {!activities || activities.length === 0 ? (
          <EmptyState title="No activity yet" description="Actions on this customer will show up here." />
        ) : (
          <ul className="mt-3 space-y-3">
            {activities.map((activity) => (
              <li key={activity.id} className="border-t border-neutral-100 pt-3 first:border-0 first:pt-0">
                <p className="text-sm text-neutral-800">{activity.title}</p>
                <p className="mt-0.5 text-xs text-neutral-500">{formatDateTime(activity.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-100 pb-2">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right text-neutral-900">{value || "—"}</dd>
    </div>
  );
}

function ExternalBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
      Synced from {label}
    </span>
  );
}
