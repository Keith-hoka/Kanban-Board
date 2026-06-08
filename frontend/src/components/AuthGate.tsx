"use client";

import { useEffect, useState } from "react";
import { getMe, logout } from "@/lib/api";
import { BoardContainer } from "@/components/BoardContainer";
import { LoginForm } from "@/components/LoginForm";

type Status = "loading" | "authed" | "anon";

export const AuthGate = () => {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    getMe()
      .then((me) => setStatus(me ? "authed" : "anon"))
      .catch(() => setStatus("anon"));
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      setStatus("anon");
    } catch {
      // Logout failed server-side; keep the user signed in rather than showing
      // a logged-out UI over a still-live session.
    }
  };

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
        Loading
      </main>
    );
  }

  if (status === "anon") {
    return <LoginForm onSuccess={() => setStatus("authed")} />;
  }

  return <BoardContainer onLogout={handleLogout} />;
};
