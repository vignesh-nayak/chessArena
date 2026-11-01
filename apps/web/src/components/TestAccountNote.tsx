import { useEffect, useRef, useState } from "react";
import "./TestAccountNote.css";

const TEST_CREDENTIALS = "testchess@gmail.com";

export function TestAccountNote() {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(TEST_CREDENTIALS);
      setCopied(true);
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
        timeoutRef.current = null;
      }, 2000);
    } catch {
      // Leave the copy icon in place if the write fails.
    }
  }

  return (
    <div className="test-account-note">
      <span>
        For testing, use
        <span className="bold-text"> {TEST_CREDENTIALS} </span>
      </span>
      <button
        type="button"
        className="test-account-note-copy"
        aria-label="Copy test credentials"
        onClick={() => {
          void onCopy();
        }}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
      <span>as both email and password.</span>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg
      className="test-account-note-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="test-account-note-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
