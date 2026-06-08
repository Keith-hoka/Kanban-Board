// Client for the FastAPI backend. Same-origin in the container; `credentials`
// ensures the session cookie is sent.

import { normalizeBoard, type BoardData } from "@/lib/kanban";

export type User = { user: string };

export async function getMe(): Promise<User | null> {
  const res = await fetch("/api/me", { credentials: "include" });
  if (res.status === 401) {
    return null;
  }
  if (!res.ok) {
    throw new Error("Failed to load session");
  }
  return res.json();
}

export async function login(username: string, password: string): Promise<User> {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
  if (res.status === 401) {
    throw new Error("Invalid username or password");
  }
  if (!res.ok) {
    throw new Error("Login failed");
  }
  return res.json();
}

export async function logout(): Promise<void> {
  const res = await fetch("/api/logout", { method: "POST", credentials: "include" });
  if (!res.ok) {
    throw new Error("Logout failed");
  }
}

export async function getBoard(): Promise<BoardData> {
  const res = await fetch("/api/board", { credentials: "include" });
  if (!res.ok) {
    throw new Error("Failed to load board");
  }
  return normalizeBoard(await res.json());
}

export async function saveBoard(board: BoardData): Promise<void> {
  const res = await fetch("/api/board", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(board),
  });
  if (!res.ok) {
    throw new Error("Failed to save board");
  }
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatResponse = {
  reply: string;
  board: BoardData;
  boardUpdated: boolean;
};

export async function sendChat(
  message: string,
  history: ChatTurn[]
): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) {
    throw new Error("Chat request failed");
  }
  const data: ChatResponse = await res.json();
  return { ...data, board: normalizeBoard(data.board) };
}
