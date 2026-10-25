import { expect, test } from "@playwright/test";
import {
  addIdea,
  root,
  node,
  openRoom,
  outline,
  PEDDLES,
  selected,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await openRoom(page);
});

test("a new map starts with bold PEDDLES categories", async ({ page }) => {
  for (const category of PEDDLES) {
    await expect(node(page, category)).toHaveClass(/category/);
    await expect(node(page, category)).toHaveCSS("font-weight", "700");
  }
});

test("Tab adds a child, Enter a sibling, Shift+Enter a new line", async ({
  page,
}) => {
  await node(page, "tools").click();
  await page.keyboard.press("Tab");
  await page.keyboard.type("CI is slow");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Flaky tests");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Long builds");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("on Fridays");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");

  expect(await outline(page)).toContain(
    "- tools\n  - CI is slow\n    - Flaky tests\n    - Long builds\non Fridays\n- team",
  );
});

test("typing on a selected node replaces its text; Esc restores it", async ({
  page,
}) => {
  await node(page, "team").click();
  await page.keyboard.type("people");
  await page.keyboard.press("Enter");
  await expect(node(page, "people")).toBeVisible();
  await page.keyboard.press("Escape"); // discards the empty sibling Enter made

  await node(page, "people").click();
  await page.keyboard.press("F2");
  await page.keyboard.type(" and pets");
  await page.keyboard.press("Escape");
  await expect(node(page, "people")).toBeVisible();
  await expect(node(page, "people and pets")).toHaveCount(0);
});

test("Esc on a new idea keeps typed text but discards an empty one", async ({
  page,
}) => {
  await addIdea(page, "events", "Outage on Tuesday");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  expect(await outline(page)).toContain(
    "- events\n  - Outage on Tuesday\n- surprises",
  );
});

test("arrow keys move between parent, children, and siblings", async ({
  page,
}) => {
  await addIdea(page, "patterns", "Same bug twice");
  await root(page).click();
  await page.keyboard.press("ArrowRight");
  await expect(selected(page)).toHaveText("patterns");
  await page.keyboard.press("ArrowRight");
  await expect(selected(page)).toHaveText("Same bug twice");
  await page.keyboard.press("ArrowLeft");
  await expect(selected(page)).toHaveText("patterns");
  await page.keyboard.press("ArrowDown");
  await expect(selected(page)).toHaveText("tools");
  await page.keyboard.press("ArrowUp");
  await expect(selected(page)).toHaveText("patterns");
  await page.keyboard.press("ArrowLeft");
  await expect(selected(page)).toHaveClass(/root/);
  await page.keyboard.press("ArrowLeft");
  await expect(selected(page)).toHaveText("emotions");
});

test("Delete removes a subtree and Ctrl+Z brings it back", async ({ page }) => {
  await addIdea(page, "domain", "Billing rules");
  await node(page, "domain").click();
  await page.keyboard.press("Delete");
  await expect(node(page, "domain")).toHaveCount(0);
  await expect(node(page, "Billing rules")).toHaveCount(0);
  await page.keyboard.press("Control+z");
  expect(await outline(page)).toContain("- domain\n  - Billing rules\n");
});

test("the center can't be deleted", async ({ page }) => {
  await root(page).click();
  await page.keyboard.press("Delete");
  await expect(root(page)).toBeVisible();
  await expect(page.locator(".status")).toContainText("can't be deleted");
});

test("Alt+Up and Alt+Down reorder siblings", async ({ page }) => {
  await addIdea(page, "team", "first");
  await addIdea(page, "team", "second");
  await node(page, "second").click();
  await page.keyboard.press("Alt+ArrowUp");
  expect(await outline(page)).toContain("- team\n  - second\n  - first\n");
  await page.keyboard.press("Alt+ArrowDown");
  expect(await outline(page)).toContain("- team\n  - first\n  - second\n");
});

test("double-click edits a node; double-click on empty space adds an idea", async ({
  page,
}) => {
  await root(page).dblclick();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("Sprint 12");
  await page.keyboard.press("Enter");
  await expect(node(page, "Sprint 12")).toHaveClass(/root/);
  await page.keyboard.press("Escape");

  await page.locator(".viewport").dblclick({ position: { x: 20, y: 20 } });
  await page.keyboard.type("Loose thought");
  await page.keyboard.press("Escape");
  await expect(node(page, "Loose thought")).toHaveClass(/category/);
});

test("the center starts as today's date and {TOPIC}", async ({ page }) => {
  const today = await page.evaluate(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  await expect(root(page)).toHaveText(`${today} {TOPIC}`);

  // Typing on the selected center fills in just the topic.
  await root(page).click();
  await page.keyboard.type("Deploys");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape"); // discards the empty child Enter made
  await expect(root(page)).toHaveText(`${today} Deploys`);
});

test("F2 on the center selects the {TOPIC} placeholder", async ({ page }) => {
  await root(page).click();
  await page.keyboard.press("F2");
  await page.keyboard.type("Onboarding");
  await page.keyboard.press("Escape");
  await expect(root(page)).toHaveText(/^\d{4}-\d\d-\d\d \{TOPIC\}$/); // Esc cancels
  await page.keyboard.press("F2");
  await page.keyboard.type("Onboarding");
  await page.keyboard.press("Enter");
  await expect(root(page)).toHaveText(/^\d{4}-\d\d-\d\d Onboarding$/);
});
