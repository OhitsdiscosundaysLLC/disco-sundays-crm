"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Resource } from "@/lib/auth/types";

const NAV_ITEMS: { href: string; label: string; resource: Resource | null }[] = [
  { href: "/dashboard", label: "Dashboard", resource: null },
  { href: "/customers", label: "Customers", resource: "customers" },
  { href: "/leads", label: "Leads", resource: "leads" },
  { href: "/bookings", label: "Bookings", resource: "bookings" },
  { href: "/services", label: "Services", resource: "services" },
  { href: "/projects", label: "Projects", resource: "projects" },
  { href: "/galleries", label: "Galleries", resource: "galleries" },
  { href: "/memberships", label: "Memberships", resource: "memberships" },
  { href: "/referrals", label: "Referrals", resource: "referrals" },
  { href: "/rewards", label: "Rewards", resource: "rewards" },
  { href: "/payments", label: "Payments", resource: "payments" },
  { href: "/tasks", label: "Tasks", resource: "tasks" },
  { href: "/reports", label: "Reports", resource: "reports" },
  { href: "/team", label: "Team", resource: "team" },
  { href: "/settings", label: "Settings", resource: "settings" },
];

/**
 * Nav visibility is filtered server-side (visibleResources comes from
 * getVisibleResources(), which calls the DB's has_permission()) — this
 * component only renders what's already been authorized, it doesn't decide
 * authorization itself. See docs/SECURITY.md: UI hiding is convenience,
 * never the security boundary; RLS still gates the actual data.
 */
export function Nav({
  visibleResources,
  displayName,
}: {
  visibleResources: Resource[];
  displayName: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const items = NAV_ITEMS.filter(
    (item) => item.resource === null || visibleResources.includes(item.resource)
  );

  return (
    <>
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 md:hidden">
        <span className="font-semibold">Disco Sundays</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle navigation"
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
        >
          Menu
        </button>
      </header>

      <nav
        className={`${open ? "block" : "hidden"} border-b border-neutral-200 md:block md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r`}
      >
        <div className="hidden px-4 py-4 md:block">
          <span className="font-semibold">Disco Sundays</span>
        </div>
        <ul className="space-y-0.5 px-2 py-2 md:px-3">
          {items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-md px-3 py-2 text-sm ${
                    active
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-700 hover:bg-neutral-100"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-neutral-200 px-3 py-3 text-xs text-neutral-500">
          Signed in as {displayName}
        </div>
      </nav>
    </>
  );
}
