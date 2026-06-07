import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthGate } from "@/components/AuthGate";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const emptyBoard = { columns: [], cards: {} };

// Route fetch by URL + method so tests do not depend on call ordering.
const mockApi = (handlers: {
  me?: Response;
  login?: Response;
  board?: Response;
}) => {
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    if (url.endsWith("/api/me")) {
      return Promise.resolve(handlers.me ?? new Response(null, { status: 401 }));
    }
    if (url.endsWith("/api/login")) {
      return Promise.resolve(
        handlers.login ?? new Response(null, { status: 401 })
      );
    }
    if (url.endsWith("/api/board")) {
      return Promise.resolve(handlers.board ?? jsonResponse(emptyBoard));
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  });
};

describe("AuthGate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the login form when unauthenticated", async () => {
    mockApi({ me: new Response(null, { status: 401 }) });
    render(<AuthGate />);
    expect(await screen.findByLabelText("Username")).toBeInTheDocument();
  });

  it("shows the board after a successful login", async () => {
    mockApi({
      me: new Response(null, { status: 401 }),
      login: jsonResponse({ user: "user" }),
      board: jsonResponse(emptyBoard),
    });
    render(<AuthGate />);

    await userEvent.type(await screen.findByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByRole("heading", { name: "Kanban Studio" })
    ).toBeInTheDocument();
  });

  it("shows an error on invalid credentials", async () => {
    mockApi({
      me: new Response(null, { status: 401 }),
      login: new Response(null, { status: 401 }),
    });
    render(<AuthGate />);

    await userEvent.type(await screen.findByLabelText("Username"), "user");
    await userEvent.type(screen.getByLabelText("Password"), "nope");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/invalid username or password/i)).toBeInTheDocument();
  });
});
