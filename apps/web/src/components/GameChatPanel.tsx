import { useEffect, useRef, useState, type FormEvent } from "react";
import { useGameChat } from "../hooks/useGameChat";

type GameChatPanelProps = {
  gameId: string;
  canSend: boolean;
};

export function GameChatPanel({ gameId, canSend }: GameChatPanelProps) {
  const { messages, error, send } = useGameChat(gameId);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSend) return;
    if (send(draft)) setDraft("");
  }

  return (
    <div className="flex max-h-40 flex-col">
      <p className="mb-2 text-xs tracking-wide text-muted uppercase">Chat</p>
      <div className="mb-2 min-h-16 flex-1 overflow-y-auto text-sm leading-6 text-text">
        {messages.length === 0 ? (
          <p className="text-muted">No messages yet</p>
        ) : (
          messages.map((message, index) => (
            <p key={`${message.sentAt}-${index}`}>
              <span className="text-muted">{message.from}: </span>
              {message.text}
            </p>
          ))
        )}
        <div ref={endRef} />
      </div>
      {error ? (
        <p className="mb-2 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      <form className="flex gap-2" onSubmit={onSubmit}>
        <input
          className="min-w-0 flex-1 border border-muted/40 bg-transparent px-2 py-1 text-sm text-text disabled:opacity-40"
          value={draft}
          maxLength={200}
          disabled={!canSend}
          placeholder="Message"
          aria-label="Chat message"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="submit"
          className="border border-muted/40 px-3 py-1.5 text-sm text-muted disabled:opacity-40"
          disabled={!canSend || !draft.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}
