import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatSidebar } from "@/components/ChatSidebar";
import * as api from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

const board: BoardData = {
  columns: [{ id: "c1", title: "Todo", cardIds: ["x"] }],
  cards: { x: { id: "x", title: "AI card", details: "" } },
};

describe("ChatSidebar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the user message and the assistant reply", async () => {
    vi.spyOn(api, "sendChat").mockResolvedValue({
      reply: "Done!",
      board,
      boardUpdated: false,
    });
    render(<ChatSidebar onBoardUpdate={() => {}} />);

    await userEvent.type(screen.getByLabelText("Chat message"), "hello");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("hello")).toBeInTheDocument();
    expect(await screen.findByText("Done!")).toBeInTheDocument();
  });

  it("calls onBoardUpdate when the board changed", async () => {
    vi.spyOn(api, "sendChat").mockResolvedValue({
      reply: "Added it.",
      board,
      boardUpdated: true,
    });
    const onBoardUpdate = vi.fn();
    render(<ChatSidebar onBoardUpdate={onBoardUpdate} />);

    await userEvent.type(screen.getByLabelText("Chat message"), "add a card");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(onBoardUpdate).toHaveBeenCalledWith(board));
  });

  it("does not call onBoardUpdate when nothing changed", async () => {
    vi.spyOn(api, "sendChat").mockResolvedValue({
      reply: "You have 1 column.",
      board,
      boardUpdated: false,
    });
    const onBoardUpdate = vi.fn();
    render(<ChatSidebar onBoardUpdate={onBoardUpdate} />);

    await userEvent.type(screen.getByLabelText("Chat message"), "how many columns?");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await screen.findByText("You have 1 column.");
    expect(onBoardUpdate).not.toHaveBeenCalled();
  });

  it("shows an error when the request fails", async () => {
    vi.spyOn(api, "sendChat").mockRejectedValue(new Error("boom"));
    render(<ChatSidebar onBoardUpdate={() => {}} />);

    await userEvent.type(screen.getByLabelText("Chat message"), "hi");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/something went wrong/i);
  });

  it("does not send empty input", async () => {
    const send = vi.spyOn(api, "sendChat");
    render(<ChatSidebar onBoardUpdate={() => {}} />);

    // Button is disabled with no input.
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Chat message"), "   ");
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
    expect(send).not.toHaveBeenCalled();
  });
});
