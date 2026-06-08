import { moveCard, normalizeBoard, type Column } from "@/lib/kanban";

describe("moveCard", () => {
  const baseColumns: Column[] = [
    { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
    { id: "col-b", title: "B", cardIds: ["card-3"] },
  ];

  it("reorders cards in the same column", () => {
    const result = moveCard(baseColumns, "card-2", "card-1");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("moves cards to another column", () => {
    const result = moveCard(baseColumns, "card-2", "card-3");
    expect(result[0].cardIds).toEqual(["card-1"]);
    expect(result[1].cardIds).toEqual(["card-2", "card-3"]);
  });

  it("drops cards to the end of a column", () => {
    const result = moveCard(baseColumns, "card-1", "col-b");
    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-3", "card-1"]);
  });

  it("inserts a card at the target card's position in another column", () => {
    const result = moveCard(baseColumns, "card-1", "card-3");
    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-1", "card-3"]);
  });

  it("returns columns unchanged for unknown ids", () => {
    expect(moveCard(baseColumns, "missing", "card-1")).toEqual(baseColumns);
    expect(moveCard(baseColumns, "card-1", "missing")).toEqual(baseColumns);
  });
});

describe("normalizeBoard", () => {
  it("drops card ids with no matching card", () => {
    const result = normalizeBoard({
      columns: [{ id: "col-a", title: "A", cardIds: ["card-1", "ghost"] }],
      cards: { "card-1": { id: "card-1", title: "Real", details: "" } },
    });
    expect(result.columns[0].cardIds).toEqual(["card-1"]);
  });

  it("keeps a valid board intact", () => {
    const board = {
      columns: [{ id: "col-a", title: "A", cardIds: ["card-1"] }],
      cards: { "card-1": { id: "card-1", title: "Real", details: "" } },
    };
    expect(normalizeBoard(board)).toEqual(board);
  });
});
