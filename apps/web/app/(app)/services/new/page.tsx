import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { ServiceForm } from "../service-form";
import { createService } from "../actions";

export default async function NewServicePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "services", "create");
  if (!allowed) redirect("/services");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">New service</h1>
      <ServiceForm
        action={createService}
        submitLabel="Create service"
        defaults={{
          name: "",
          description: null,
          category: null,
          price: null,
          duration_minutes: null,
          active: true,
          internal_notes: null,
        }}
      />
    </div>
  );
}
