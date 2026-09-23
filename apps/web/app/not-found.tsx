import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center">
      <h1 className="text-lg font-semibold text-neutral-900">
        Page not found
      </h1>
      <p className="text-sm text-neutral-500">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 text-sm font-medium text-neutral-900 underline"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
