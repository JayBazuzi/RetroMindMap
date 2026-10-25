import { expect, test } from "@playwright/test";
import { addIdea, node, openRoom, selected } from "./helpers";

const URL = "https://example.com/retro";
const TEXT = `Notes: ${URL}`;

test.beforeEach(async ({ page }) => {
  await openRoom(page);
  // Keep tests offline: any opened page gets a stub instead of the real site.
  await page
    .context()
    .route("https://example.com/**", (route) =>
      route.fulfill({ body: "<title>stub</title>" }),
    );
  await addIdea(page, "tools", TEXT);
});

test("URLs in a node are shown as links", async ({ page }) => {
  const link = node(page, TEXT).locator("a");
  await expect(link).toHaveText(URL);
  await expect(link).toHaveAttribute("href", URL);
});

test("a plain click on a link selects the node and opens nothing", async ({
  page,
}) => {
  let opened = false;
  page.context().on("page", () => (opened = true));
  await node(page, TEXT).locator("a").click();
  await expect(selected(page)).toHaveText(TEXT);
  await page.waitForTimeout(500);
  expect(opened).toBe(false);
  expect(page.url()).not.toContain("example.com");
});

test("Ctrl+click on a link opens it in a new tab", async ({ page }) => {
  const popup = page.context().waitForEvent("page");
  await node(page, TEXT)
    .locator("a")
    .click({ modifiers: ["ControlOrMeta"] });
  await expect(await popup).toHaveURL(URL);
  expect(page.url()).not.toContain("example.com");
});

test("Ctrl+Enter opens the link in the selected node", async ({ page }) => {
  await node(page, TEXT).click();
  const popup = page.context().waitForEvent("page");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(await popup).toHaveURL(URL);
});

test("editing shows plain text, and the link comes back after", async ({
  page,
}) => {
  await node(page, TEXT).click();
  await page.keyboard.press("F2");
  await expect(node(page, TEXT).locator("a")).toHaveCount(0);
  await page.keyboard.type(" more");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape"); // discards the empty sibling
  await expect(node(page, `${TEXT} more`).locator("a")).toHaveText(URL);
});

test("Copy outline also puts linked HTML on the clipboard", async ({
  page,
}) => {
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await page.getByRole("button", { name: "Copy outline" }).click();
  const html = () =>
    page.evaluate(async () => {
      const [item] = await navigator.clipboard.read();
      if (!item.types.includes("text/html")) return "";
      return (await item.getType("text/html")).text();
    });
  await expect.poll(html).toContain(`<a href="${URL}">${URL}</a>`);
});

test("non-http text that looks like a link stays plain", async ({ page }) => {
  await addIdea(page, "team", "javascript:alert(1)");
  await expect(node(page, "javascript:alert(1)").locator("a")).toHaveCount(0);
});
