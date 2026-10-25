import { expect, test } from "@playwright/test";
import { addIdea, root, node, openRoom, outline } from "./helpers";

test.beforeEach(async ({ page }) => {
  await openRoom(page);
});

test("dragging a node onto another moves it there", async ({ page }) => {
  await addIdea(page, "tools", "Pairing");
  await node(page, "Pairing").dragTo(node(page, "team"));
  expect(await outline(page)).toContain("- team\n  - Pairing\n");
  expect(await outline(page)).toContain("- tools\n- team");
});

test("a node can't be dropped into its own subtree", async ({ page }) => {
  await addIdea(page, "tools", "Pairing");
  await node(page, "tools").dragTo(node(page, "Pairing"));
  expect(await outline(page)).toContain("- tools\n  - Pairing\n");
});

test("dragging a category to open space on the other side flips it", async ({
  page,
}) => {
  const box = (await node(page, "patterns").boundingBox())!;
  const center = (await root(page).boundingBox())!;
  expect(box.x).toBeGreaterThan(center.x);
  await node(page, "patterns").hover();
  await page.mouse.down();
  await page.mouse.move(center.x - 300, box.y + 200, { steps: 5 });
  await page.mouse.up();
  await expect
    .poll(async () => (await node(page, "patterns").boundingBox())!.x)
    .toBeLessThan(center.x);
});

test("dragging the background pans and Ctrl+wheel zooms", async ({ page }) => {
  const before = (await root(page).boundingBox())!;
  await page.mouse.move(50, 300);
  await page.mouse.down();
  await page.mouse.move(150, 350, { steps: 3 });
  await page.mouse.up();
  const panned = (await root(page).boundingBox())!;
  expect(panned.x - before.x).toBeCloseTo(100, 0);
  expect(panned.y - before.y).toBeCloseTo(50, 0);

  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -300);
  await page.keyboard.up("Control");
  await expect
    .poll(async () => (await root(page).boundingBox())!.width)
    .toBeGreaterThan(before.width * 1.2);

  await page.getByRole("button", { name: "Center" }).click();
  expect((await root(page).boundingBox())!.width).toBeCloseTo(before.width, 0);
});

test("Copy share link copies the room URL", async ({ page }) => {
  await page.getByRole("button", { name: "Copy share link" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    page.url(),
  );
});

test("Copy image puts a PNG of the whole map on the clipboard", async ({
  page,
}) => {
  await addIdea(page, "surprises", "We shipped early");
  await page.getByRole("button", { name: "Copy image" }).click();
  await expect(page.locator(".status")).toContainText("Image copied");
  const size = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    const blob = await item.getType("image/png");
    const bitmap = await createImageBitmap(blob);
    return { width: bitmap.width, height: bitmap.height };
  });
  const map = await page.evaluate(() => {
    const rects = [...document.querySelectorAll(".node")].map((n) =>
      n.getBoundingClientRect(),
    );
    return {
      width:
        Math.max(...rects.map((r) => r.right)) -
        Math.min(...rects.map((r) => r.left)),
      height:
        Math.max(...rects.map((r) => r.bottom)) -
        Math.min(...rects.map((r) => r.top)),
    };
  });
  // 2x resolution, plus a 32px margin on each side. Layout rounds node sizes
  // to whole pixels, so allow a little drift from the on-screen measurement.
  const ratio = (actual: number, mapSize: number) =>
    actual / ((mapSize + 64) * 2);
  expect(ratio(size.width, map.width)).toBeGreaterThan(0.98);
  expect(ratio(size.width, map.width)).toBeLessThan(1.02);
  expect(ratio(size.height, map.height)).toBeGreaterThan(0.98);
  expect(ratio(size.height, map.height)).toBeLessThan(1.02);
});

test("Export then Import round-trips the map", async ({ page }) => {
  await addIdea(page, "language", "Ubiquitous terms");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  const file = await (await download).path();
  const exported = await outline(page);

  await openRoom(page);
  expect(await outline(page)).not.toContain("Ubiquitous terms");
  await page.locator("[data-action=import]").setInputFiles(file);
  await expect(page.locator(".status")).toContainText("Imported");
  expect(await outline(page)).toBe(exported);
});

test("importing a file that isn't a map leaves the map alone", async ({
  page,
}) => {
  const before = await outline(page);
  await page.locator("[data-action=import]").setInputFiles({
    name: "junk.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"hello": 1}'),
  });
  await expect(page.locator(".status")).toContainText("isn't a Retro Mind Map");
  expect(await outline(page)).toBe(before);
});
