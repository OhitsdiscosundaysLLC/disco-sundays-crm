import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { CustomerForm } from "../customer-form";
import { createCustomer } from "../actions";

export default async function NewCustomerPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const allowed = await hasPermission(profile.role, "customers", "create");
  if (!allowed) redirect("/customers");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-neutral-900">New customer</h1>
      <CustomerForm
        action={createCustomer}
        submitLabel="Create customer"
        defaults={{
          first_name: null,
          last_name: null,
          email: null,
          phone: null,
          location: null,
          company: null,
          artist_name: null,
          instagram: null,
          customer_type: null,
          source: null,
          referral_source: null,
          status: "active",
        }}
      />
    </div>
  );
}
