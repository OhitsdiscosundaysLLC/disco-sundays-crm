"use client";

/**
 * A <select> that submits its enclosing form on change. `action` must be a
 * real Server Action (passing functions as props to a Client Component only
 * works for Server Actions, not arbitrary closures) — event handlers like
 * onChange can't be attached directly to elements rendered by a Server
 * Component, so this wrapper exists purely to hold that one handler.
 */
export function AutoSubmitSelect({
  action,
  name,
  defaultValue,
  options,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <form action={action}>
      <select
        name={name}
        defaultValue={defaultValue}
        className={className ?? "rounded-md border border-neutral-300 px-1.5 py-0.5 text-xs"}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </form>
  );
}
