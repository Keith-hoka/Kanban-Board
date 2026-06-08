"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import clsx from "clsx";
import { sendChat, type ChatTurn } from "@/lib/api";
import { createId, type BoardData } from "@/lib/kanban";

type ChatSidebarProps = {
  onBoardUpdate: (board: BoardData) => void;
  // Flush any unsaved board edits before sending, so the AI reads the latest.
  onBeforeSend?: () => Promise<void>;
};

type Message = ChatTurn & { id: string };

export const ChatSidebar = ({ onBoardUpdate, onBeforeSend }: ChatSidebarProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Scroll only the message list to its bottom - never the page.
    const list = listRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages, pending]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || pending) {
      return;
    }

    const history: ChatTurn[] = messages.map(({ role, content }) => ({
      role,
      content,
    }));
    setMessages((prev) => [
      ...prev,
      { id: createId("msg"), role: "user", content: text },
    ]);
    setInput("");
    setError(null);
    setPending(true);

    try {
      await onBeforeSend?.();
      const res = await sendChat(text, history);
      setMessages((prev) => [
        ...prev,
        { id: createId("msg"), role: "assistant", content: res.reply },
      ]);
      if (res.boardUpdated) {
        onBoardUpdate(res.board);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <aside
      data-testid="chat-sidebar"
      className="flex h-[70vh] w-full flex-col overflow-hidden rounded-3xl border border-[var(--stroke)] bg-white/80 shadow-[var(--shadow)] backdrop-blur lg:h-[520px] lg:w-[360px] lg:shrink-0"
    >
      <div className="border-b border-[var(--stroke)] px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--gray-text)]">
          Assistant
        </p>
        <p className="mt-1 text-sm text-[var(--navy-dark)]">
          Ask me to create, move, or edit cards.
        </p>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <p className="text-sm leading-6 text-[var(--gray-text)]">
            Try: &ldquo;Add a card &lsquo;Draft launch plan&rsquo; to Backlog&rdquo; or
            &ldquo;Move QA micro-interactions to Done&rdquo;.
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            data-testid={`chat-${message.role}`}
            className={clsx(
              "max-w-[90%] rounded-2xl px-4 py-2 text-sm leading-6",
              message.role === "user"
                ? "ml-auto bg-[var(--secondary-purple)] text-white"
                : "mr-auto bg-[var(--surface)] text-[var(--navy-dark)]"
            )}
          >
            {message.content}
          </div>
        ))}
        {pending && (
          <div className="mr-auto rounded-2xl bg-[var(--surface)] px-4 py-2 text-sm text-[var(--gray-text)]">
            Thinking...
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-[var(--secondary-purple)]">
            {error}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-[var(--stroke)] p-4">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Ask the assistant"
            aria-label="Chat message"
            rows={2}
            className="flex-1 resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </aside>
  );
};
