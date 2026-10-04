"use client";

import { useFormStatus } from "react-dom";

export function WorkSubmitButton({
  label,
  pendingLabel,
  className = "button-primary",
  confirmMessage,
}: {
  label: string;
  pendingLabel: string;
  className?: string;
  confirmMessage?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
