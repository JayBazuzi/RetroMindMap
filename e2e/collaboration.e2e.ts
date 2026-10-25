import { expect, test } from "@playwright/test";
import { addIdea, node, openRoom, outline, uniqueRoom } from "./helpers";

// Two pages in one browser context share localStorage and BroadcastChannel,
// which is how local mode syncs. That stands in for two people on Firebase.
test("edits, names, and selections show up for the other person", async ({
  context,
}) => {
  const room = uniqueRoom();
  const alex = await context.newPage();
  const sam = await context.newPage();
  await openRoom(alex, room);
  await openRoom(sam, room);

  await sam.locator(".name").fill("Sam");
  await addIdea(sam, "emotions", "Proud of the release");
  await expect(node(alex, "Proud of the release")).toBeVisible();
  await expect(alex.locator(".person")).toHaveAttribute("title", "Sam");
  await expect(node(alex, "Proud of the release")).toHaveAttribute(
    "data-peer",
    "Sam",
  );

  await node(sam, "tools").click();
  await expect(node(alex, "tools")).toHaveAttribute("data-peer", "Sam");
  await expect(node(alex, "Proud of the release")).not.toHaveAttribute(
    "data-peer",
  );
});

test("typing is visible to others before the edit is finished", async ({
  context,
}) => {
  const room = uniqueRoom();
  const alex = await context.newPage();
  const sam = await context.newPage();
  await openRoom(alex, room);
  await openRoom(sam, room);

  await node(sam, "team").click();
  await sam.keyboard.press("Tab");
  await sam.keyboard.type("Half a thou");
  await expect(node(alex, "Half a thou")).toBeVisible();
});

test("someone leaving removes their avatar", async ({ context }) => {
  const room = uniqueRoom();
  const alex = await context.newPage();
  const sam = await context.newPage();
  await openRoom(alex, room);
  await openRoom(sam, room);
  await sam.locator(".name").fill("Sam");
  await expect(alex.locator(".person")).toHaveCount(1);
  await sam.close({ runBeforeUnload: true });
  await expect(alex.locator(".person")).toHaveCount(0);
});

test("nodes cut off from the center are cleaned up", async ({ page }) => {
  // What a race can leave behind: a child whose branch was deleted, and a
  // fragment from an edit that landed after its node was deleted.
  const room = await openRoom(page);
  await addIdea(page, "domain", "Survivor");
  await page.evaluate((r) => {
    const key = `retro-mind-map:${r}`;
    const nodes = JSON.parse(localStorage.getItem(key)!);
    nodes.lost = {
      id: "lost",
      parentId: "deleted-branch",
      text: "Lost idea",
      order: 0,
    };
    nodes.fragment = { text: "typed after delete" };
    localStorage.setItem(key, JSON.stringify(nodes));
  }, room);
  await page.reload();

  await expect(node(page, "Survivor")).toBeVisible();
  await expect(page.locator(".node")).toHaveCount(1 + 8 + 1);
  const stored = await page.evaluate(
    (r) =>
      Object.keys(JSON.parse(localStorage.getItem(`retro-mind-map:${r}`)!)),
    room,
  );
  expect(stored).not.toContain("lost");
  expect(stored).not.toContain("fragment");
});

test("deleting a branch while someone types in it doesn't bring it back", async ({
  context,
}) => {
  const room = uniqueRoom();
  const alex = await context.newPage();
  const sam = await context.newPage();
  await openRoom(alex, room);
  await openRoom(sam, room);

  await node(sam, "domain").click();
  await sam.keyboard.press("Tab");
  await sam.keyboard.type("Late idea");
  await node(alex, "domain").click();
  await alex.keyboard.press("Delete");
  await expect(node(sam, "domain")).toHaveCount(0);
  await sam.keyboard.type(" and more");
  await sam.keyboard.press("Escape");

  expect(await outline(alex)).not.toContain("Late idea");
  await alex.reload();
  expect(await outline(alex)).not.toContain("Late idea");
});

test("the map is still there after reloading", async ({ page }) => {
  const room = await openRoom(page);
  await addIdea(page, "patterns", "Survives reload");
  await page.reload();
  await expect(node(page, "Survives reload")).toBeVisible();
  expect(room).toBeTruthy();
});

test("after your node is deleted mid-edit, the keyboard still works", async ({
  context,
}) => {
  const room = uniqueRoom();
  const alex = await context.newPage();
  const sam = await context.newPage();
  const errors: string[] = [];
  sam.on("pageerror", (e) => errors.push(e.message));
  await openRoom(alex, room);
  await openRoom(sam, room);

  await node(sam, "team").click();
  await sam.keyboard.press("Tab");
  await sam.keyboard.type("Doomed");
  await node(alex, "team").click();
  await alex.keyboard.press("Delete");
  await expect(node(sam, "team")).toHaveCount(0);

  await expect(sam.locator(".viewport")).toBeFocused();
  await sam.keyboard.press("Tab");
  await sam.keyboard.type("Still working");
  await sam.keyboard.press("Escape");
  await expect(node(alex, "Still working")).toBeVisible();
  expect(errors).toEqual([]);
});
