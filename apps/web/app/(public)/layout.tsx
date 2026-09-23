/**
 * Shell for the public, unauthenticated surfaces (/gallery/[slug],
 * /embed/gallery/[id], /join, /r/[code]) — no nav, no auth check.
 * middleware.ts already exempts these path prefixes from the login
 * redirect (docs/ARCHITECTURE.md §4).
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-white">{children}</div>;
}
