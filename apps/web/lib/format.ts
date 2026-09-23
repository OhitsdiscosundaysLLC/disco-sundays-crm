export function customerLabel(customer: {
  display_name: string | null;
  email: string | null;
  phone: string | null;
}): string {
  return customer.display_name || customer.email || customer.phone || "Unnamed customer";
}

export function leadLabel(lead: {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}): string {
  const full = [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim();
  return full || lead.email || lead.phone || "Unnamed lead";
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
