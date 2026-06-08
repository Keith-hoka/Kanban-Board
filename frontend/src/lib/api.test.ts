import { afterEach, describe, expect, it, vi } from "vitest";
import { getBoard, login, logout, saveBoard } from "@/lib/api";

const board = { columns: [], cards: {} };

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getBoard returns the board JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(board));
    await expect(getBoard()).resolves.toEqual(board);
  });

  it("getBoard throws on a non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));
    await expect(getBoard()).rejects.toThrow();
  });

  it("saveBoard PUTs the board as JSON", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
    await saveBoard(board);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/board",
      expect.objectContaining({ method: "PUT" })
    );
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual(board);
  });

  it("saveBoard throws on a non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));
    await expect(saveBoard(board)).rejects.toThrow();
  });

  it("login throws a clear error on 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }));
    await expect(login("user", "wrong")).rejects.toThrow(/invalid/i);
  });

  it("getBoard drops card ids with no matching card", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        columns: [{ id: "col-a", title: "A", cardIds: ["card-1", "ghost"] }],
        cards: { "card-1": { id: "card-1", title: "Real", details: "" } },
      })
    );
    const result = await getBoard();
    expect(result.columns[0].cardIds).toEqual(["card-1"]);
  });

  it("logout throws on a non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));
    await expect(logout()).rejects.toThrow();
  });
});
