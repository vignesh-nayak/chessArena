import { useToastStore } from "../store/toastStore";

export function ErrorToast() {
  const current = useToastStore((s) => s.current);
  const dismiss = useToastStore((s) => s.dismiss);
  if (!current) return null;

  return (
    <div
      className="fixed right-4 bottom-4 left-4 z-50 mx-auto flex max-w-md items-start justify-between gap-3 border border-red-400/70 bg-bg px-4 py-3 text-sm text-text"
      role="alert"
    >
      <p>{current.message}</p>
      <button
        type="button"
        className="shrink-0 text-muted hover:text-text"
        onClick={dismiss}
      >
        Close
      </button>
    </div>
  );
}
