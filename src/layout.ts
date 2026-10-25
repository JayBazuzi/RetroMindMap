import { childrenOf, MapNodes, ROOT_ID, Side } from "./mapModel";

export interface Size {
  width: number;
  height: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  side: Side;
}

export const H_GAP = 48;
export const V_GAP = 12;

/**
 * Classic two-sided mind map layout: root at the origin, first-level children
 * split left/right, each subtree stacked vertically. Coordinates are box centers.
 */
export function layout(
  nodes: MapNodes,
  sizeOf: (id: string) => Size,
): Record<string, Box> {
  const boxes: Record<string, Box> = {};
  const heights = new Map<string, number>();

  const subtreeHeight = (id: string): number => {
    const own = sizeOf(id).height;
    const kids = childrenOf(nodes, id);
    const kidsHeight =
      kids.reduce((sum, k) => sum + subtreeHeight(k.id), 0) +
      V_GAP * Math.max(0, kids.length - 1);
    const h = Math.max(own, kidsHeight);
    heights.set(id, h);
    return h;
  };

  const place = (id: string, x: number, y: number, side: Side) => {
    const size = sizeOf(id);
    boxes[id] = { x, y, ...size, side };
    stack(
      childrenOf(nodes, id).map((k) => k.id),
      x,
      size.width,
      y,
      side,
    );
  };

  const stack = (
    ids: string[],
    parentX: number,
    parentWidth: number,
    centerY: number,
    side: Side,
  ) => {
    const total =
      ids.reduce((sum, id) => sum + heights.get(id)!, 0) +
      V_GAP * Math.max(0, ids.length - 1);
    let top = centerY - total / 2;
    const dir = side === "right" ? 1 : -1;
    for (const id of ids) {
      const h = heights.get(id)!;
      const x =
        parentX + dir * (parentWidth / 2 + H_GAP + sizeOf(id).width / 2);
      place(id, x, top + h / 2, side);
      top += h + V_GAP;
    }
  };

  if (!nodes[ROOT_ID]) return boxes;
  const rootSize = sizeOf(ROOT_ID);
  boxes[ROOT_ID] = { x: 0, y: 0, ...rootSize, side: "right" };
  const firstLevel = childrenOf(nodes, ROOT_ID);
  firstLevel.forEach((k) => subtreeHeight(k.id));
  for (const side of ["right", "left"] as const) {
    const ids = firstLevel
      .filter((k) => (k.side ?? "right") === side)
      .map((k) => k.id);
    stack(ids, 0, rootSize.width, 0, side);
  }
  return boxes;
}
