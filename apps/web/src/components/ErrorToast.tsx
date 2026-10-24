import { useToastStore } from "../store/toastStore";
import "./ErrorToast.css";

export function ErrorToast() {
  const current = useToastStore((s) => s.current);
  const dismiss = useToastStore((s) => s.dismiss);
  if (!current) return null;

  return (
    <div
      className="error-toast"
      role="alert"
    >
      <p>{current.message}</p>
      <button
        type="button"
        className="error-toast-close"
        onClick={dismiss}
      >
        Close
      </button>
    </div>
  );
}
