"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-800">
      <p className="font-medium">Something went wrong.</p>
      <p className="mt-1 text-red-700">
        {process.env.NODE_ENV === "development"
          ? error.message
          : "Please try again, or contact support if this keeps happening."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-3 rounded-md border border-red-300 px-3 py-1.5 text-red-800 hover:bg-red-100"
      >
        Try again
      </button>
    </div>
  );
}
