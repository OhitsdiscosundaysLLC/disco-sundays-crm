import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { getVisibleResources } from "@/lib/auth/permissions";
import { Nav } from "@/components/nav";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * Shell for every authenticated route. middleware.ts already redirects
 * unauthenticated requests to /login before they reach here; this layout
 * additionally rejects a signed-in-but-not-yet-active account (status !==
 * 'active' — e.g. a freshly invited staff member) and computes which nav
 * sections this user's role may view.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");
  if (profile.status !== "active") redirect("/login?status=inactive");

  const visibleResources = await getVisibleResources(profile.role);
  const displayName = profile.display_name || profile.email || "there";

  return (
    <div className="min-h-screen md:flex">
      <Nav visibleResources={visibleResources} displayName={displayName} />
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="hidden items-center justify-end border-b border-neutral-200 px-6 py-3 md:flex">
          <SignOutButton />
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
