import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel, leadLabel } from "@/lib/format";
import { sanitizeSearchTerm } from "@/lib/search";

type ResultGroup = {
  label: string;
  items: { href: string; primary: string; secondary?: string }[];
};

/**
 * Searches across the resources this role can view (spec: global search).
 * Each query runs under the viewer's own RLS-scoped session — same
 * posture as Reports — so results never exceed what the user could
 * already see on that resource's own page.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { q } = await searchParams;
  const term = sanitizeSearchTerm(q ?? "");
  const supabase = await createClient();
  const groups: ResultGroup[] = [];

  if (term.length >= 2) {
    const [canCustomers, canLeads, canProjects, canGalleries, canReferrals] = await Promise.all([
      hasPermission(profile.role, "customers", "view"),
      hasPermission(profile.role, "leads", "view"),
      hasPermission(profile.role, "projects", "view"),
      hasPermission(profile.role, "galleries", "view"),
      hasPermission(profile.role, "referrals", "view"),
    ]);

    const pattern = `%${term}%`;

    if (canCustomers) {
      const { data } = await supabase
        .from("customers")
        .select("id, display_name, email, phone")
        .is("deleted_at", null)
        .or(`display_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
        .limit(10);
      if (data?.length) {
        groups.push({
          label: "Customers",
          items: data.map((c) => ({ href: `/customers/${c.id}`, primary: customerLabel(c), secondary: c.email ?? undefined })),
        });
      }
    }

    if (canLeads) {
      const { data } = await supabase
        .from("leads")
        .select("id, first_name, last_name, email, phone")
        .is("deleted_at", null)
        .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`)
        .limit(10);
      if (data?.length) {
        groups.push({
          label: "Leads",
          items: data.map((l) => ({ href: `/leads/${l.id}`, primary: leadLabel(l), secondary: l.email ?? undefined })),
        });
      }
    }

    if (canProjects) {
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .is("deleted_at", null)
        .ilike("name", pattern)
        .limit(10);
      if (data?.length) {
        groups.push({
          label: "Projects",
          items: data.map((p) => ({ href: `/projects/${p.id}/edit`, primary: p.name })),
        });
      }
    }

    if (canGalleries) {
      const { data } = await supabase
        .from("galleries")
        .select("id, title")
        .is("deleted_at", null)
        .ilike("title", pattern)
        .limit(10);
      if (data?.length) {
        groups.push({
          label: "Galleries",
          items: data.map((g) => ({ href: `/galleries/${g.id}`, primary: g.title })),
        });
      }
    }

    if (canReferrals) {
      const { data } = await supabase.from("referrals").select("id, code").ilike("code", pattern).limit(10);
      if (data?.length) {
        groups.push({
          label: "Referrals",
          items: data.map((r) => ({ href: `/referrals/${r.id}`, primary: r.code || r.id })),
        });
      }
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Search</h1>
        <form action="/search" method="get" className="mt-3">
          <input
            type="text"
            name="q"
            defaultValue={term}
            placeholder="Search customers, leads, projects, galleries, referrals…"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
            autoFocus
          />
        </form>
      </div>

      {term.length > 0 && term.length < 2 ? (
        <p className="text-sm text-neutral-500">Keep typing — search needs at least 2 characters.</p>
      ) : term.length >= 2 && groups.length === 0 ? (
        <p className="text-sm text-neutral-500">No results for &ldquo;{term}&rdquo;.</p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="text-sm font-medium text-neutral-500">{group.label}</h2>
              <ul className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-neutral-50">
                      <span className="text-neutral-900">{item.primary}</span>
                      {item.secondary ? <span className="text-neutral-500">{item.secondary}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
