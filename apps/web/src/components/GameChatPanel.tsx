import { useEffect, useRef, useState, type FormEvent } from "react";
import { useGameChat } from "../hooks/useGameChat";
import "./GameChatPanel.css";

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
    <div className="game-chat">
      <p className="game-chat-label">Chat</p>
      <div className="game-chat-log">
        {messages.length === 0 ? (
          <p className="game-chat-empty">No messages yet</p>
        ) : (
          messages.map((message, index) => (
            <p key={`${message.sentAt}-${index}`}>
              <span className="game-chat-from">{message.from}: </span>
              {message.text}
            </p>
          ))
        )}
        <div ref={endRef} />
      </div>
      {error ? (
        <p className="game-chat-error" role="alert">
          {error}
        </p>
      ) : null}
      <form className="game-chat-form" onSubmit={onSubmit}>
        <input
          className="game-chat-input"
          value={draft}
          maxLength={200}
          disabled={!canSend}
          placeholder="Message"
          aria-label="Chat message"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="submit"
          className="game-chat-send"
          disabled={!canSend || !draft.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}
