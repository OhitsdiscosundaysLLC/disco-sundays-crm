import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { GalleryForm } from "../../gallery-form";
import { updateGallerySettings } from "../../actions";

export default async function EditGalleryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "galleries", "edit");
  if (!allowed) redirect("/galleries");

  const { id } = await params;
  const supabase = await createClient();

  const [{ data: gallery }, { data: projects }] = await Promise.all([
    supabase
      .from("galleries")
      .select("id, project_id, title, description, visibility, expires_at, allow_downloads, password_hash")
      .eq("id", id)
      .is("deleted_at", null)
      .single(),
    supabase.from("projects").select("id, name").is("deleted_at", null).order("name"),
  ]);

  if (!gallery) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">Edit gallery</h1>
      <GalleryForm
        action={updateGallerySettings}
        submitLabel="Save changes"
        projectOptions={(projects ?? []).map((p) => ({ value: p.id, label: p.name }))}
        defaults={{
          id: gallery.id,
          project_id: gallery.project_id,
          title: gallery.title,
          description: gallery.description,
          visibility: gallery.visibility,
          expires_at: gallery.expires_at,
          allow_downloads: gallery.allow_downloads,
          hasPassword: Boolean(gallery.password_hash),
        }}
      />
    </div>
  );
}
