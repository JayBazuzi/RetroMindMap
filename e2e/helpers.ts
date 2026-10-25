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

/**
 * Every browser context shares the real OS clipboard, so parallel tests would
 * clobber each other (and the developer's clipboard). Give each page its own.
 */
function fakeClipboard() {
  let items: ClipboardItem[] = [];
  const text = (type: string) => new Blob([""], { type });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      write: async (next: ClipboardItem[]) => {
        items = next;
      },
      writeText: async (t: string) => {
        items = [
          new ClipboardItem({
            "text/plain": new Blob([t], { type: "text/plain" }),
          }),
        ];
      },
      read: async () => items,
      readText: async () => {
        const item = items.find((i) => i.types.includes("text/plain"));
        return (
          await (item?.getType("text/plain") ?? text("text/plain"))
        ).text();
      },
    },
  });
}

const withFakeClipboard = new WeakSet<Page>();

export async function openRoom(page: Page, room = uniqueRoom()) {
  if (!withFakeClipboard.has(page)) {
    withFakeClipboard.add(page);
    await page.addInitScript(fakeClipboard);
  }
  await page.goto(`/#${room}`);
  await expect(page.locator(".node.root")).toBeVisible();
  await expect(page.locator(".viewport")).toBeFocused();
  return room;
}

export function uniqueRoom() {
  return `test-${Math.random().toString(36).slice(2, 10)}`;
}

export function node(page: Page, text: string) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return page.locator(".node").filter({ hasText: new RegExp(`^${escaped}$`) });
}

export const root = (page: Page) => page.locator(".node.root");

export const selected = (page: Page) => page.locator(".node.selected");

/** The map as an outline, read straight from the clipboard via the toolbar. */
export async function outline(page: Page): Promise<string> {
  // The copy finishes after the click returns, so clear first and wait for it.
  const read = () => page.evaluate(() => navigator.clipboard.readText());
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await page.getByRole("button", { name: "Copy outline" }).click();
  await expect.poll(read).not.toBe("");
  return (await read()).replace(/\r\n/g, "\n"); // Windows clipboard uses CRLF
}

export async function addIdea(page: Page, category: string, text: string) {
  await node(page, category).click();
  await page.keyboard.press("Tab");
  await page.keyboard.type(text);
  await page.keyboard.press("Escape");
  await expect(node(page, text)).toBeVisible();
}
