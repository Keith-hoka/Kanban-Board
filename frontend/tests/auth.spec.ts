import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("requires login before showing the board", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kanban Studio" })
  ).toHaveCount(0);
});

test("rejects invalid credentials", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText(/invalid username or password/i)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kanban Studio" })
  ).toHaveCount(0);
});

test("logs in, persists across reload, and logs out", async ({ page }) => {
  await login(page);

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Kanban Studio" })
  ).toBeVisible();

  await page.getByRole("button", { name: /log out/i }).click();
  await expect(page.getByLabel("Username")).toBeVisible();
});
