import { expect, Page } from "@playwright/test";

export const PEDDLES = [
  "patterns",
  "emotions",
  "tools",
  "team",
  "domain",
  "language",
  "events",
  "surprises",
];

export async function openRoom(page: Page, room = uniqueRoom()) {
  await page.goto(`/#${room}`);
  await expect(page.locator(".node.root")).toBeVisible();
  await expect(page.locator(".viewport")).toBeFocused();
  return room;
}

export function uniqueRoom() {
  return `test-${Math.random().toString(36).slice(2, 10)}`;
}

export function node(page: Page, text: string) {
  return page.locator(".node").filter({ hasText: new RegExp(`^${text}$`) });
}

export const root = (page: Page) => page.locator(".node.root");

export const selected = (page: Page) => page.locator(".node.selected");

/** The map as an outline, read straight from the clipboard via the toolbar. */
export async function outline(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Copy outline" }).click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  return text.replace(/\r\n/g, "\n"); // Windows clipboard uses CRLF
}

export async function addIdea(page: Page, category: string, text: string) {
  await node(page, category).click();
  await page.keyboard.press("Tab");
  await page.keyboard.type(text);
  await page.keyboard.press("Escape");
  await expect(node(page, text)).toBeVisible();
}
