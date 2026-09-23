import { redirect } from "next/navigation";

export default function RootPage() {
  // middleware.ts already gates unauthenticated requests to /login;
  // an authenticated hit on "/" lands on the dashboard.
  redirect("/dashboard");
}
