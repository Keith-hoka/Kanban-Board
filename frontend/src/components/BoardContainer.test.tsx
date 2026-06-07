import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BoardContainer } from "@/components/BoardContainer";
import * as api from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

const sampleBoard: BoardData = {
  columns: [{ id: "col-1", title: "Todo", cardIds: [] }],
  cards: {},
};

describe("BoardContainer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading, then the board", async () => {
    vi.spyOn(api, "getBoard").mockResolvedValue(sampleBoard);
    render(<BoardContainer onLogout={() => {}} />);

    expect(screen.getByText(/loading board/i)).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Kanban Studio" })
    ).toBeInTheDocument();
  });

  it("persists changes via saveBoard", async () => {
    vi.spyOn(api, "getBoard").mockResolvedValue(sampleBoard);
    const save = vi.spyOn(api, "saveBoard").mockResolvedValue();
    render(<BoardContainer onLogout={() => {}} />);

    const column = await screen.findByTestId("column-col-1");
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "Saved card");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    await waitFor(() => expect(save).toHaveBeenCalled());
    const savedBoard = save.mock.calls.at(-1)?.[0] as BoardData;
    expect(
      Object.values(savedBoard.cards).some((card) => card.title === "Saved card")
    ).toBe(true);
  });

  it("shows an error when the board fails to load", async () => {
    vi.spyOn(api, "getBoard").mockRejectedValue(new Error("boom"));
    render(<BoardContainer onLogout={() => {}} />);

    expect(await screen.findByText(/could not load your board/i)).toBeInTheDocument();
  });
});
