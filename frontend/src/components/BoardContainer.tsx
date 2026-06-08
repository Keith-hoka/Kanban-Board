"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getBoard, saveBoard } from "@/lib/api";
import { KanbanBoard } from "@/components/KanbanBoard";
import { ChatSidebar } from "@/components/ChatSidebar";
import type { BoardData } from "@/lib/kanban";

type Status = "loading" | "ready" | "error";

const Centered = ({ children }: { children: React.ReactNode }) => (
  <main className="flex min-h-screen items-center justify-center px-6 text-center text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
    {children}
  </main>
);

type BoardContainerProps = {
  onLogout: () => void;
};

// Loads the board from the API, then persists every change with a debounced
// full-board PUT (500ms after the last edit).
export const BoardContainer = ({ onLogout }: BoardContainerProps) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [saveFailed, setSaveFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The latest edited board awaiting its debounced save.
  const pending = useRef<BoardData | null>(null);
  // Set when an AI update is applied, so the resulting onChange is not re-saved.
  const skipNextSave = useRef(false);

  useEffect(() => {
    let active = true;
    getBoard()
      .then((data) => {
        if (active) {
          setBoard(data);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (active) {
          setStatus("error");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Save the pending board now, cancelling any scheduled save. Used both by the
  // debounce timer and to flush before a chat request, so the AI reads the
  // user's latest board rather than overwriting unsaved edits.
  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const next = pending.current;
    if (!next) {
      return;
    }
    pending.current = null;
    try {
      await saveBoard(next);
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }, []);

  const handleChange = useCallback(
    (next: BoardData) => {
      if (skipNextSave.current) {
        // This change is an AI board the server already persisted; do not re-save.
        skipNextSave.current = false;
        return;
      }
      pending.current = next;
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(flush, 500);
    },
    [flush]
  );

  // The AI already persisted the board server-side; pushing it into state lets
  // KanbanBoard pick it up (via its initialBoard sync) without a remount. Flag
  // the resulting onChange so it is not saved again.
  const handleBoardFromChat = useCallback((next: BoardData) => {
    skipNextSave.current = true;
    setBoard(next);
  }, []);

  if (status === "loading") {
    return <Centered>Loading board</Centered>;
  }

  if (status === "error" || !board) {
    return <Centered>Could not load your board. Refresh to try again.</Centered>;
  }

  return (
    <>
      {saveFailed && (
        <div
          role="alert"
          className="fixed inset-x-0 top-0 z-50 bg-[var(--secondary-purple)] px-4 py-2 text-center text-sm font-semibold text-white"
        >
          Changes could not be saved. Check your connection.
        </div>
      )}
      <KanbanBoard
        initialBoard={board}
        onChange={handleChange}
        onLogout={onLogout}
        sidebar={
          <ChatSidebar onBoardUpdate={handleBoardFromChat} onBeforeSend={flush} />
        }
      />
    </>
  );
};
