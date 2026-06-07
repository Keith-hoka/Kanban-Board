import { expect, type Page } from "@playwright/test";
import { initialData } from "../src/lib/kanban";

// Log in with the hardcoded MVP credentials and wait for the board to render.
export async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(
    page.getByRole("heading", { name: "Kanban Studio" })
  ).toBeVisible();
}

// Restore the seeded board so each board test starts from a known state. The
// board is now persisted server-side, so without this tests would leak into
// each other. Requires an authenticated session (call after login).
export async function resetBoard(page: Page) {
  const res = await page.request.put("/api/board", { data: initialData });
  expect(res.ok()).toBeTruthy();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Kanban Studio" })
  ).toBeVisible();
}
