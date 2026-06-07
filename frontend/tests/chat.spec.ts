import { expect, test } from "@playwright/test";
import { login, resetBoard } from "./helpers";

test.beforeEach(async ({ page }) => {
  await login(page);
  await resetBoard(page);
});

test("AI chat reply and board refresh without reload", async ({ page }) => {
  const updatedBoard = {
    columns: [{ id: "col-backlog", title: "Backlog", cardIds: ["ai-1"] }],
    cards: { "ai-1": { id: "ai-1", title: "AI added card", details: "via chat" } },
  };

  // Stub the AI so the test is deterministic and offline.
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      json: { reply: "Added it.", board: updatedBoard, boardUpdated: true },
    })
  );

  await page.getByPlaceholder("Ask the assistant").fill("add a card to backlog");
  await page.getByRole("button", { name: /send/i }).click();

  // Assistant reply shows in the sidebar.
  await expect(page.getByText("Added it.")).toBeVisible();
  // Board refreshed in place (no reload) with the AI's card.
  await expect(page.getByText("AI added card")).toBeVisible();
});

test("shows an error when the chat request fails", async ({ page }) => {
  await page.route("**/api/chat", (route) =>
    route.fulfill({ status: 502, json: { detail: "bad" } })
  );

  await page.getByPlaceholder("Ask the assistant").fill("do something");
  await page.getByRole("button", { name: /send/i }).click();

  await expect(page.getByText(/something went wrong/i)).toBeVisible();
});
