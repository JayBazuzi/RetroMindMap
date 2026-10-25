export type Side = "left" | "right";

export interface MapNode {
  id: string;
  parentId: string | null;
  text: string;
  /** Fractional sort key among siblings, so concurrent inserts don't collide. */
  order: number;
  /** Only meaningful for children of the root. */
  side?: Side;
  /** Branch color index; only meaningful for children of the root. */
  color?: number;
}

export type MapNodes = Record<string, MapNode>;

export const ROOT_ID = "root";
export const BRANCH_COLOR_COUNT = 8;

/** PEDDLES retro categories. */
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

export function newId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function emptyMap(title = "Retro"): MapNodes {
  return { [ROOT_ID]: { id: ROOT_ID, parentId: null, text: title, order: 0 } };
}

/**
 * A fresh map preloaded with the PEDDLES categories. Ids are fixed so that
 * clients creating the map at the same moment write the same nodes.
 */
export function newRetroMap(): MapNodes {
  const nodes = emptyMap();
  for (const text of PEDDLES) {
    const node = makeChild(nodes, ROOT_ID, text);
    node.id = `peddles-${text}`;
    nodes[node.id] = node;
  }
  return nodes;
}

export function childrenOf(nodes: MapNodes, parentId: string): MapNode[] {
  return Object.values(nodes)
    .filter((n) => n.parentId === parentId)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function sideOf(nodes: MapNodes, id: string): Side {
  let node = nodes[id];
  while (node && node.parentId !== null && node.parentId !== ROOT_ID) {
    node = nodes[node.parentId];
  }
  return node?.side ?? "right";
}

/** Returns the new node, ready to be stored. */
export function makeChild(
  nodes: MapNodes,
  parentId: string,
  text = "",
): MapNode {
  const siblings = childrenOf(nodes, parentId);
  const last = siblings[siblings.length - 1];
  const node: MapNode = {
    id: newId(),
    parentId,
    text,
    order: last ? last.order + 1 : 0,
  };
  if (parentId === ROOT_ID) {
    const rights = siblings.filter((s) => s.side !== "left").length;
    node.side = rights > siblings.length - rights ? "left" : "right";
    const uses = Array<number>(BRANCH_COLOR_COUNT).fill(0);
    for (const s of siblings) if (s.color !== undefined) uses[s.color]++;
    node.color = uses.indexOf(Math.min(...uses));
  }
  return node;
}

/** Returns the new node placed right after `id`, or null for the root. */
export function makeSiblingAfter(
  nodes: MapNodes,
  id: string,
  text = "",
): MapNode | null {
  const node = nodes[id];
  if (!node || node.parentId === null) return null;
  const siblings = childrenOf(nodes, node.parentId);
  const next = siblings[siblings.indexOf(node) + 1];
  const result: MapNode = {
    id: newId(),
    parentId: node.parentId,
    text,
    order: next ? (node.order + next.order) / 2 : node.order + 1,
  };
  if (node.side) result.side = node.side;
  return result;
}

/** The node and all its descendants, ids only. */
export function subtreeIds(nodes: MapNodes, id: string): string[] {
  const result = [id];
  for (const child of childrenOf(nodes, id)) {
    result.push(...subtreeIds(nodes, child.id));
  }
  return result;
}

export function isAncestor(
  nodes: MapNodes,
  ancestorId: string,
  id: string,
): boolean {
  for (let n = nodes[id]; n; n = nodes[n.parentId ?? ""]) {
    if (n.id === ancestorId) return true;
  }
  return false;
}

/** Node to select after `id` is deleted. */
export function neighborAfterDelete(nodes: MapNodes, id: string): string {
  const node = nodes[id];
  if (!node || node.parentId === null) return ROOT_ID;
  const siblings = childrenOf(nodes, node.parentId);
  const i = siblings.indexOf(node);
  return (siblings[i + 1] ?? siblings[i - 1] ?? nodes[node.parentId]).id;
}

/** Text outline, handy for pasting retro results into notes. */
export function toOutline(nodes: MapNodes, id = ROOT_ID, depth = 0): string {
  const node = nodes[id];
  if (!node) return "";
  const line =
    depth === 0
      ? `${node.text}\n`
      : `${"  ".repeat(depth - 1)}- ${node.text}\n`;
  return (
    line +
    childrenOf(nodes, id)
      .map((c) => toOutline(nodes, c.id, depth + 1))
      .join("")
  );
}
