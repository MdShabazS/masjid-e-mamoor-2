"use client";

type Props = {
  children: string;
  className?: string;
  confirmMessage?: string;
};

export function FinanceStatusSubmitButton({
  children,
  className,
  confirmMessage,
}: Props) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (
          confirmMessage &&
          !window.confirm(confirmMessage)
        ) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
