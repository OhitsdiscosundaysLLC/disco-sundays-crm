import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { CustomerForm } from "../../customer-form";
import { updateCustomer } from "../../actions";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "customers", "edit");
  if (!allowed) redirect("/customers");

  const { id } = await params;
  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select(
      "id, first_name, last_name, email, phone, location, company, artist_name, instagram, customer_type, source, referral_source, status"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!customer) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">Edit customer</h1>
      <CustomerForm action={updateCustomer} submitLabel="Save changes" defaults={customer} />
    </div>
  );
}
