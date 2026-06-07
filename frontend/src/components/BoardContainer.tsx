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

  const handleChange = useCallback((next: BoardData) => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      saveBoard(next)
        .then(() => setSaveFailed(false))
        .catch(() => setSaveFailed(true));
    }, 500);
  }, []);

  // The AI already persisted the board server-side; pushing it into state lets
  // KanbanBoard pick it up (via its initialBoard sync) without a remount.
  const handleBoardFromChat = useCallback((next: BoardData) => {
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
        sidebar={<ChatSidebar onBoardUpdate={handleBoardFromChat} />}
      />
    </>
  );
};
