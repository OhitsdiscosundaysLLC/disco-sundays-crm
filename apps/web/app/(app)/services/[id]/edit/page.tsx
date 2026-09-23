import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { ServiceForm } from "../../service-form";
import { updateService } from "../../actions";

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "services", "edit");
  if (!allowed) redirect("/services");

  const { id } = await params;
  const supabase = await createClient();
  const { data: service } = await supabase
    .from("services")
    .select("id, name, description, category, price, duration_minutes, active, internal_notes")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!service) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">Edit service</h1>
      <ServiceForm action={updateService} submitLabel="Save changes" defaults={service} />
    </div>
  );
}
