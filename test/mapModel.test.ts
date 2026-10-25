import { describe, expect, test } from "vitest";
import {
  childrenOf,
  emptyMap,
  isAncestor,
  makeChild,
  makeSiblingAfter,
  MapNodes,
  newRetroMap,
  orphanIds,
  PEDDLES,
  neighborAfterDelete,
  ROOT_ID,
  sideOf,
  subtreeIds,
  toOutline,
} from "../src/mapModel";
import { layout } from "../src/layout";

function add(nodes: MapNodes, node: { id: string } | null) {
  if (node) nodes[node.id] = node as MapNodes[string];
  return node!.id;
}

describe("map model", () => {
  test("first-level children alternate sides", () => {
    const m = emptyMap();
    const sides = [1, 2, 3, 4].map(
      (i) => m[add(m, makeChild(m, ROOT_ID, `c${i}`))].side,
    );
    expect(sides).toEqual(["right", "left", "right", "left"]);
  });

  test("sibling inserts between existing siblings", () => {
    const m = emptyMap();
    const a = add(m, makeChild(m, ROOT_ID, "a"));
    add(m, makeChild(m, ROOT_ID, "c"));
    add(m, makeSiblingAfter(m, a, "b"));
    expect(childrenOf(m, ROOT_ID).map((n) => n.text)).toEqual(["a", "b", "c"]);
  });

  test("root has no siblings", () => {
    expect(makeSiblingAfter(emptyMap(), ROOT_ID)).toBeNull();
  });

  test("subtree, ancestry, side inheritance", () => {
    const m = emptyMap();
    add(m, makeChild(m, ROOT_ID, "right one"));
    const left = add(m, makeChild(m, ROOT_ID, "left one"));
    const grandkid = add(m, makeChild(m, left, "deep"));
    expect(subtreeIds(m, left)).toEqual([left, grandkid]);
    expect(isAncestor(m, left, grandkid)).toBe(true);
    expect(isAncestor(m, grandkid, left)).toBe(false);
    expect(sideOf(m, grandkid)).toBe("left");
  });

  test("selection after delete prefers next sibling, then previous, then parent", () => {
    const m = emptyMap();
    const a = add(m, makeChild(m, ROOT_ID, "a"));
    const b = add(m, makeChild(m, ROOT_ID, "b"));
    const only = add(m, makeChild(m, a, "only"));
    expect(neighborAfterDelete(m, a)).toBe(b);
    expect(neighborAfterDelete(m, b)).toBe(a);
    expect(neighborAfterDelete(m, only)).toBe(a);
  });

  test("outline", () => {
    const m = emptyMap("Sprint 12");
    const good = add(m, makeChild(m, ROOT_ID, "Went well"));
    add(m, makeChild(m, good, "Pairing"));
    add(m, makeChild(m, ROOT_ID, "To improve"));
    expect(toOutline(m)).toBe(
      "Sprint 12\n- Went well\n  - Pairing\n- To improve\n",
    );
  });
});

describe("layout", () => {
  const size = () => ({ width: 100, height: 20 });

  test("children sit beside their parent on their side, stacked vertically", () => {
    const m = emptyMap();
    const r = add(m, makeChild(m, ROOT_ID, "r"));
    const l = add(m, makeChild(m, ROOT_ID, "l"));
    const r1 = add(m, makeChild(m, r, "r1"));
    const r2 = add(m, makeChild(m, r, "r2"));
    const boxes = layout(m, size);
    expect(boxes[ROOT_ID]).toMatchObject({ x: 0, y: 0 });
    expect(boxes[r].x).toBeGreaterThan(0);
    expect(boxes[l].x).toBeLessThan(0);
    expect(boxes[r1].x).toBeGreaterThan(boxes[r].x);
    expect(boxes[r1].y).toBeLessThan(boxes[r2].y);
    expect(boxes[r2].y - boxes[r1].y).toBeGreaterThanOrEqual(20);
    expect((boxes[r1].y + boxes[r2].y) / 2).toBeCloseTo(boxes[r].y);
  });
});

test("top-level branches get distinct colors, reusing freed ones", () => {
  const m = emptyMap();
  const ids = [1, 2, 3].map((i) => add(m, makeChild(m, ROOT_ID, `c${i}`)));
  expect(ids.map((id) => m[id].color)).toEqual([0, 1, 2]);
  const freed = m[ids[1]].color;
  delete m[ids[1]];
  expect(makeChild(m, ROOT_ID).color).toBe(freed);
});

test("new retro map is preloaded with PEDDLES, each its own color", () => {
  const m = newRetroMap();
  const categories = childrenOf(m, ROOT_ID);
  expect(categories.map((c) => c.text)).toEqual(PEDDLES);
  expect(new Set(categories.map((c) => c.color)).size).toBe(8);
  expect(newRetroMap()).toEqual(m);
});

test("orphans are nodes cut off from the root", () => {
  const m = newRetroMap();
  const idea = add(m, makeChild(m, "peddles-tools", "idea"));
  const deeper = add(m, makeChild(m, idea, "deeper"));
  expect(orphanIds(m)).toEqual([]);
  delete m["peddles-tools"];
  m.fragment = { text: "typed after delete" } as MapNodes[string];
  expect(orphanIds(m).sort()).toEqual([idea, deeper, "fragment"].sort());
});
