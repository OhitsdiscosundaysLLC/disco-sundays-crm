import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { customerLabel } from "@/lib/format";
import { GalleryForm } from "../gallery-form";
import { createGallery } from "../actions";

export default async function NewGalleryPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "galleries", "create");
  if (!allowed) redirect("/galleries");

  const supabase = await createClient();
  const [{ data: customers }, { data: projects }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, display_name, email, phone")
      .is("deleted_at", null)
      .order("display_name")
      .limit(200),
    supabase.from("projects").select("id, name").is("deleted_at", null).order("name"),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">New gallery</h1>
      <GalleryForm
        action={createGallery}
        submitLabel="Create gallery"
        customerOptions={(customers ?? []).map((c) => ({ value: c.id, label: customerLabel(c) }))}
        projectOptions={(projects ?? []).map((p) => ({ value: p.id, label: p.name }))}
        defaults={{
          customer_id: null,
          project_id: null,
          title: "",
          description: null,
          visibility: "private",
          expires_at: null,
          allow_downloads: true,
        }}
      />
    </div>
  );
}
