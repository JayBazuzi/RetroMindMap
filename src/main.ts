import "./style.css";
import { layout, Box } from "./layout";
import {
  childrenOf,
  isAncestor,
  makeChild,
  makeSiblingAfter,
  MapNodes,
  neighborAfterDelete,
  newRoomId,
  orphanIds,
  ROOT_ID,
  Side,
  sideOf,
  subtreeIds,
  TOPIC_PLACEHOLDER,
  toOutline,
  toOutlineHtml,
} from "./mapModel";
import { linkify } from "./links";
import { copyMapImage, drawMap } from "./mapImage";
import { MapStore, openStore, peerColor, Presence } from "./store";

const BRANCH_COLORS = [
  "#e8590c",
  "#1971c2",
  "#2f9e44",
  "#9c36b5",
  "#c2255c",
  "#0c8599",
  "#f08c00",
  "#5c7cfa",
];
const PERSON_COLORS = [
  "#e03131",
  "#1c7ed6",
  "#37b24d",
  "#ae3ec9",
  "#f76707",
  "#1098ad",
];

function roomFromHash(): string {
  let room = location.hash.slice(1);
  if (!/^[\w-]{4,64}$/.test(room)) {
    room = newRoomId();
    history.replaceState(null, "", `#${room}`);
  }
  return room;
}

function storedName(): string {
  try {
    return localStorage.getItem("retro-mind-map:name") ?? "";
  } catch {
    return "";
  }
}

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <header class="toolbar">
    <strong class="brand">Retro Mind Map</strong>
    <button data-action="share" title="Copy a link others can open">Copy share link</button>
    <button data-action="image" title="Copy the whole map as a picture">Copy image</button>
    <button data-action="outline" title="Copy the map as a bulleted outline">Copy outline</button>
    <button data-action="export">Export</button>
    <label class="button">Import<input type="file" accept=".json" hidden data-action="import" /></label>
    <button data-action="center">Center</button>
    <span class="spacer"></span>
    <span class="people"></span>
    <input class="name" placeholder="Your name" maxlength="24" />
    <button data-action="help" title="Keyboard shortcuts">?</button>
  </header>
  <div class="viewport" tabindex="0">
    <div class="canvas"><svg class="edges"></svg></div>
  </div>
  <div class="status"></div>
  <aside class="help" hidden>
    <h2>Keyboard</h2>
    <dl>
      <dt>Tab</dt><dd>Add child</dd>
      <dt>Enter</dt><dd>Add sibling</dd>
      <dt>Type / F2 / Space</dt><dd>Edit selected</dd>
      <dt>Enter / Esc</dt><dd>While editing: done / cancel</dd>
      <dt>Shift+Enter</dt><dd>While editing: new line</dd>
      <dt>Arrows</dt><dd>Move selection</dd>
      <dt>Alt+↑ / Alt+↓</dt><dd>Reorder</dd>
      <dt>Delete</dt><dd>Delete node and children</dd>
      <dt>Ctrl+Z</dt><dd>Undo your last delete</dd>
      <dt>Ctrl+Enter</dt><dd>Open the link in the selected node</dd>
    </dl>
    <h2>Mouse</h2>
    <dl>
      <dt>Double-click</dt><dd>Edit (on background: add idea)</dd>
      <dt>Drag node</dt><dd>Move onto another node</dd>
      <dt>Ctrl+click link</dt><dd>Open it</dd>
      <dt>Drag background</dt><dd>Pan</dd>
      <dt>Ctrl+wheel</dt><dd>Zoom</dd>
    </dl>
  </aside>
`;

const viewport = app.querySelector<HTMLDivElement>(".viewport")!;
const canvas = app.querySelector<HTMLDivElement>(".canvas")!;
const edges = app.querySelector<SVGSVGElement>(".edges")!;
const status = app.querySelector<HTMLDivElement>(".status")!;
const people = app.querySelector<HTMLSpanElement>(".people")!;
const nameInput = app.querySelector<HTMLInputElement>(".name")!;
const help = app.querySelector<HTMLElement>(".help")!;

let store: MapStore;
let nodes: MapNodes = {};
let others: Record<string, Presence> = {};
let boxes: Record<string, Box> = {};
let selectedId: string | null = ROOT_ID;
let editingId: string | null = null;
let editOriginal = "";
let editIsNew = false;
/** Selected again if a new node is discarded. */
let editReturnId: string = ROOT_ID;
let pan = { x: 0, y: 0 };
let zoom = 1;
const elements = new Map<string, HTMLDivElement>();
const undoStack: MapNodes[] = [];
const myColor = PERSON_COLORS[Math.floor(Math.random() * PERSON_COLORS.length)];

nameInput.value = storedName();

function flash(message: string) {
  status.textContent = message;
  status.classList.add("show");
  setTimeout(() => status.classList.remove("show"), 1800);
}

function branchColor(id: string): string {
  if (id === ROOT_ID) return "#343a40";
  let n = nodes[id];
  while (n && n.parentId !== ROOT_ID && n.parentId) n = nodes[n.parentId];
  return BRANCH_COLORS[(n?.color ?? 0) % BRANCH_COLORS.length];
}

function applyTransform() {
  canvas.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
}

function centerView() {
  pan = { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
  zoom = 1;
  applyTransform();
}

function elementFor(id: string): HTMLDivElement {
  let el = elements.get(id);
  if (!el) {
    el = document.createElement("div");
    el.className = "node";
    el.dataset.id = id;
    canvas.appendChild(el);
    elements.set(id, el);
  }
  return el;
}

function render() {
  if (selectedId && !nodes[selectedId]) selectedId = ROOT_ID;
  // Someone deleted what we were editing. Stop editing before its element goes,
  // since removing a focused element fires focusout, which would finish the edit.
  const lostEdit = editingId !== null && !nodes[editingId];
  if (lostEdit) editingId = null;
  for (const [id, el] of elements) {
    if (!nodes[id]) {
      elements.delete(id);
      el.remove();
    }
  }
  if (lostEdit) viewport.focus();

  for (const node of Object.values(nodes)) {
    const el = elementFor(node.id);
    if (node.id !== editingId && el.dataset.shown !== node.text) {
      showText(el, node.text);
    }
    el.classList.toggle("root", node.id === ROOT_ID);
    el.classList.toggle("category", node.parentId === ROOT_ID);
    el.classList.toggle("empty", !node.text && node.id !== editingId);
    el.classList.toggle("selected", node.id === selectedId);
    el.classList.toggle("editing", node.id === editingId);
    el.style.setProperty("--branch", branchColor(node.id));
    el.style.removeProperty("--peer");
    el.removeAttribute("data-peer");
  }
  for (const p of Object.values(others)) {
    const el = p.selectedId ? elements.get(p.selectedId) : undefined;
    if (el) {
      el.style.setProperty("--peer", peerColor(p));
      el.dataset.peer = p.name || "someone";
    }
  }

  // Measure at scale 1, then lay out.
  const sizes = new Map<string, { width: number; height: number }>();
  for (const [id, el] of elements) {
    sizes.set(id, { width: el.offsetWidth, height: el.offsetHeight });
  }
  boxes = layout(nodes, (id) => sizes.get(id)!);

  let paths = "";
  for (const node of Object.values(nodes)) {
    const box = boxes[node.id];
    const el = elements.get(node.id)!;
    if (!box) continue; // orphan whose parent was deleted remotely
    el.style.left = `${box.x - box.width / 2}px`;
    el.style.top = `${box.y - box.height / 2}px`;
    const parent = node.parentId ? boxes[node.parentId] : undefined;
    if (parent) {
      const dir = box.side === "right" ? 1 : -1;
      const x1 = parent.x + (dir * parent.width) / 2;
      const x2 = box.x - (dir * box.width) / 2;
      const mx = (x1 + x2) / 2;
      paths += `<path d="M${x1},${parent.y} C${mx},${parent.y} ${mx},${box.y} ${x2},${box.y}" stroke="${branchColor(node.id)}" />`;
    }
  }
  edges.innerHTML = paths;

  renderPeople();
}

const OPEN_HINT = /Mac|iPhone|iPad/.test(navigator.platform)
  ? "⌘+click to open"
  : "Ctrl+click to open";

/** Node text with its URLs as links. */
function showText(el: HTMLElement, text: string) {
  el.replaceChildren(
    ...linkify(text).map((part) => {
      if (!part.href) return document.createTextNode(part.text);
      const a = document.createElement("a");
      a.href = part.href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.title = OPEN_HINT;
      a.textContent = part.text;
      return a;
    }),
  );
  el.dataset.shown = text;
}

function openLink(href: string) {
  window.open(href, "_blank", "noopener,noreferrer");
}

function renderPeople() {
  people.replaceChildren(
    ...Object.values(others).map((p) => {
      const dot = document.createElement("span");
      dot.className = "person";
      dot.style.background = peerColor(p);
      dot.textContent = (p.name || "?").slice(0, 1).toUpperCase();
      dot.title = p.name || "Someone";
      return dot;
    }),
  );
}

function publishPresence() {
  store?.setPresence({
    name: nameInput.value.trim(),
    color: myColor,
    selectedId,
  });
}

function select(id: string | null) {
  selectedId = id;
  render();
  publishPresence();
  if (id)
    elements.get(id)?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
}

// ---- Editing -------------------------------------------------------------

function startEdit(
  id: string,
  { replace = false, isNew = false, returnTo = ROOT_ID } = {},
) {
  if (editingId) finishEdit();
  const el = elements.get(id);
  if (!el) return;
  editingId = id;
  editOriginal = nodes[id].text;
  editIsNew = isNew;
  editReturnId = returnTo;
  selectedId = id;
  const placeholder = editOriginal.indexOf(TOPIC_PLACEHOLDER);
  // Edit plain text; links come back when the edit finishes.
  el.textContent = replace && placeholder < 0 ? "" : editOriginal;
  delete el.dataset.shown;
  el.contentEditable = "plaintext-only";
  render();
  el.focus();
  const range = document.createRange();
  if (placeholder >= 0 && el.firstChild) {
    range.setStart(el.firstChild, placeholder);
    range.setEnd(el.firstChild, placeholder + TOPIC_PLACEHOLDER.length);
  } else {
    range.selectNodeContents(el);
    range.collapse(false);
  }
  getSelection()?.removeAllRanges();
  getSelection()?.addRange(range);
  publishPresence();
}

function finishEdit({ cancel = false } = {}) {
  const id = editingId;
  if (!id) return;
  const el = elements.get(id)!;
  editingId = null;
  el.contentEditable = "false";
  const text = (el.innerText ?? "").trim();
  // A new node left empty, however the edit ends, is discarded.
  if (editIsNew && (cancel || !text)) {
    selectedId = nodes[editReturnId] ? editReturnId : ROOT_ID;
    store.remove([id]);
  } else if (cancel) {
    el.textContent = editOriginal;
    store.update(id, { text: editOriginal });
  } else {
    store.update(id, { text });
  }
  if (document.activeElement === el || document.activeElement === document.body)
    viewport.focus();
  render();
  publishPresence();
}

canvas.addEventListener("input", (e) => {
  const el = e.target as HTMLElement;
  // Skip if someone deleted the node mid-edit, so typing can't recreate it.
  if (el.dataset.id === editingId && nodes[editingId]) {
    // Live typing is visible to everyone.
    store.update(editingId!, { text: el.innerText });
    render();
  }
});

canvas.addEventListener("focusout", (e) => {
  if ((e.target as HTMLElement).dataset.id === editingId) finishEdit();
});

// ---- Commands ------------------------------------------------------------

function addChild(parentId: string) {
  const node = makeChild(nodes, parentId);
  store.put(node);
  startEdit(node.id, { isNew: true, returnTo: parentId });
}

function addSibling(id: string) {
  const node = makeSiblingAfter(nodes, id);
  if (!node) return addChild(id);
  store.put(node);
  startEdit(node.id, { isNew: true, returnTo: id });
}

function deleteNode(id: string) {
  if (id === ROOT_ID)
    return flash("The center can't be deleted — edit it instead");
  const ids = subtreeIds(nodes, id);
  undoStack.push(Object.fromEntries(ids.map((i) => [i, nodes[i]])));
  const next = neighborAfterDelete(nodes, id);
  store.remove(ids);
  select(next);
}

function undo() {
  const restored = undoStack.pop();
  if (!restored) return flash("Nothing to undo");
  for (const node of Object.values(restored)) store.put(node);
  select(Object.keys(restored)[0]);
}

function reorder(id: string, delta: -1 | 1) {
  const node = nodes[id];
  if (!node?.parentId) return;
  const siblings = childrenOf(nodes, node.parentId).filter(
    (s) => node.parentId !== ROOT_ID || s.side === node.side,
  );
  const i = siblings.indexOf(node);
  const other = siblings[i + delta];
  if (!other) return;
  store.update(id, { order: other.order });
  store.update(other.id, { order: node.order });
}

function moveNode(id: string, newParentId: string, side?: Side) {
  if (id === ROOT_ID || isAncestor(nodes, id, newParentId)) return;
  const placed = makeChild(nodes, newParentId);
  store.update(id, {
    parentId: newParentId,
    order: placed.order,
    side: newParentId === ROOT_ID ? (side ?? placed.side) : undefined,
    color: placed.color,
  });
}

function navigate(key: string) {
  const id = selectedId ?? ROOT_ID;
  const node = nodes[id];
  const box = boxes[id];
  if (!node || !box) return;
  const horizontal = key === "ArrowLeft" || key === "ArrowRight";
  if (horizontal) {
    const towardRight = key === "ArrowRight";
    if (id === ROOT_ID) {
      const side: Side = towardRight ? "right" : "left";
      const first = childrenOf(nodes, ROOT_ID).find(
        (c) => (c.side ?? "right") === side,
      );
      if (first) select(first.id);
      return;
    }
    const outward = (box.side === "right") === towardRight;
    if (outward) {
      const kids = childrenOf(nodes, id);
      if (kids.length) select(kids[Math.floor((kids.length - 1) / 2)].id);
    } else {
      select(node.parentId);
    }
    return;
  }
  // Up/down: nearest node vertically on the same side, preferring the same depth.
  const dir = key === "ArrowDown" ? 1 : -1;
  let best: string | null = null;
  let bestScore = Infinity;
  for (const [otherId, b] of Object.entries(boxes)) {
    if (otherId === id || otherId === ROOT_ID || b.side !== box.side) continue;
    const dy = (b.y - box.y) * dir;
    if (dy <= 0) continue;
    const score = dy + Math.abs(b.x - box.x) * 2;
    if (score < bestScore) {
      bestScore = score;
      best = otherId;
    }
  }
  if (best) select(best);
}

viewport.addEventListener("keydown", (e) => {
  if (editingId) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const id = editingId;
      finishEdit();
      if (nodes[id]) addSibling(id);
    } else if (e.key === "Tab") {
      e.preventDefault();
      const id = editingId;
      finishEdit();
      if (nodes[id]) addChild(id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      // Esc on a new idea keeps what was typed; finishing discards an empty one.
      finishEdit({ cancel: !editIsNew });
    }
    return;
  }
  const id = selectedId ?? ROOT_ID;
  const mod = e.ctrlKey || e.metaKey;
  if (e.key === "Tab") addChild(id);
  else if (e.key === "Enter" && mod) {
    const href = linkify(nodes[id]?.text ?? "").find((p) => p.href)?.href;
    if (href) openLink(href);
    else flash("No link in this node");
  } else if (e.key === "Enter") addSibling(id);
  else if (e.key === "Delete" || e.key === "Backspace") deleteNode(id);
  else if (e.key === "F2" || e.key === " ") startEdit(id);
  else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown"))
    reorder(id, e.key === "ArrowUp" ? -1 : 1);
  else if (e.key.startsWith("Arrow")) navigate(e.key);
  else if (mod && e.key.toLowerCase() === "z") undo();
  else if (e.key === "Escape") help.hidden = true;
  else if (e.key.length === 1 && !mod && !e.altKey) {
    // Start typing to replace, like a spreadsheet cell.
    startEdit(id, { replace: true });
    return; // let the character land in the editor
  } else return;
  e.preventDefault();
});

// ---- Mouse ---------------------------------------------------------------

let drag:
  | { kind: "pan"; startX: number; startY: number; panX: number; panY: number }
  | { kind: "node"; id: string; startX: number; startY: number; moved: boolean }
  | null = null;

function nodeAt(clientX: number, clientY: number): string | null {
  const el = document
    .elementsFromPoint(clientX, clientY)
    .find(
      (e) =>
        e instanceof HTMLElement &&
        e.dataset.id &&
        !e.classList.contains("dragging"),
    );
  return (el as HTMLElement | undefined)?.dataset.id ?? null;
}

viewport.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  const id = (e.target as HTMLElement).closest<HTMLElement>(".node")?.dataset
    .id;
  if (id && id === editingId) return;
  e.preventDefault();
  // Pointer capture below keeps the link's own click from firing, so open it here.
  const link = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
  if (link && (e.ctrlKey || e.metaKey)) {
    openLink(link.href);
    return;
  }
  viewport.focus();
  if (id) {
    if (editingId) finishEdit();
    select(id);
    drag = {
      kind: "node",
      id,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
  } else {
    if (editingId) finishEdit();
    drag = {
      kind: "pan",
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    viewport.classList.add("panning");
  }
  viewport.setPointerCapture(e.pointerId);
});

viewport.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;
  if (drag.kind === "pan") {
    pan = { x: drag.panX + dx, y: drag.panY + dy };
    applyTransform();
    return;
  }
  if (drag.id === ROOT_ID) return;
  if (!drag.moved && Math.hypot(dx, dy) < 6) return;
  drag.moved = true;
  const el = elements.get(drag.id)!;
  el.classList.add("dragging");
  el.style.translate = `${dx / zoom}px ${dy / zoom}px`;
  const target = nodeAt(e.clientX, e.clientY);
  for (const [otherId, other] of elements) {
    other.classList.toggle(
      "drop-target",
      otherId === target && !isAncestor(nodes, drag.id, otherId),
    );
  }
});

viewport.addEventListener("pointerup", (e) => {
  if (drag?.kind === "node" && drag.moved) {
    const el = elements.get(drag.id)!;
    el.classList.remove("dragging");
    el.style.translate = "";
    for (const other of elements.values())
      other.classList.remove("drop-target");
    const target = nodeAt(e.clientX, e.clientY);
    if (target && target !== drag.id) {
      const rect = viewport.getBoundingClientRect();
      const side: Side = e.clientX - rect.left > pan.x ? "right" : "left";
      moveNode(drag.id, target, side);
    } else if (nodes[drag.id]?.parentId === ROOT_ID) {
      // Dropped in open space: allow flipping a top-level branch to the other side.
      const rect = viewport.getBoundingClientRect();
      const side: Side = e.clientX - rect.left > pan.x ? "right" : "left";
      if (side !== sideOf(nodes, drag.id)) store.update(drag.id, { side });
    }
  }
  drag = null;
  viewport.classList.remove("panning");
});

viewport.addEventListener("dblclick", (e) => {
  // Pointer capture retargets this event to the viewport, so hit-test instead.
  const id = nodeAt(e.clientX, e.clientY);
  if (id) startEdit(id);
  else addChild(ROOT_ID);
});

viewport.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const rect = viewport.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const next = Math.min(
        3,
        Math.max(0.2, zoom * Math.exp(-e.deltaY * 0.0015)),
      );
      pan = {
        x: cx - ((cx - pan.x) * next) / zoom,
        y: cy - ((cy - pan.y) * next) / zoom,
      };
      zoom = next;
    } else {
      pan = { x: pan.x - e.deltaX, y: pan.y - e.deltaY };
    }
    applyTransform();
  },
  { passive: false },
);

// ---- Toolbar -------------------------------------------------------------

app.querySelector(".toolbar")!.addEventListener("click", async (e) => {
  const action = (e.target as HTMLElement).closest<HTMLElement>("[data-action]")
    ?.dataset.action;
  // Hand the keyboard back to the map so shortcuts keep working.
  if (action) viewport.focus();
  if (action === "share") {
    await navigator.clipboard.writeText(location.href);
    flash("Link copied — anyone with it can edit");
  } else if (action === "image") {
    if (editingId) finishEdit();
    try {
      await copyMapImage(drawMap(nodes, boxes, elements, branchColor));
      flash("Image copied — paste it anywhere");
    } catch {
      flash("Couldn't copy the image in this browser");
    }
  } else if (action === "outline") {
    const blob = (text: string, type: string) => new Blob([text], { type });
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/plain": blob(toOutline(nodes), "text/plain"),
        "text/html": blob(toOutlineHtml(nodes), "text/html"),
      }),
    ]);
    flash("Outline copied");
  } else if (action === "export") {
    const blob = new Blob([JSON.stringify(nodes, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${nodes[ROOT_ID]?.text || "retro"}.json`.replace(
      /[\\/:*?"<>|]/g,
      "_",
    );
    a.click();
    URL.revokeObjectURL(a.href);
  } else if (action === "center") {
    centerView();
  } else if (action === "help") {
    help.hidden = !help.hidden;
  }
});

app
  .querySelector<HTMLInputElement>("[data-action=import]")!
  .addEventListener("change", async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text()) as MapNodes;
      if (!imported[ROOT_ID]) throw new Error("no root");
      store.remove(Object.keys(nodes));
      for (const node of Object.values(imported)) store.put(node);
      flash("Imported");
    } catch {
      flash("That file isn't a Retro Mind Map export");
    }
  });

nameInput.addEventListener("input", () => {
  try {
    localStorage.setItem("retro-mind-map:name", nameInput.value.trim());
  } catch {
    // name just won't be remembered
  }
  publishPresence();
});

addEventListener("hashchange", () => location.reload());

// ---- Start ---------------------------------------------------------------

centerView();
openStore(roomFromHash()).then((s) => {
  store = s;
  store.onNodes((n) => {
    nodes = n;
    const orphans = orphanIds(n);
    if (orphans.length) store.remove(orphans);
    render();
  });
  store.onPresence((p) => {
    others = p;
    render();
  });
  publishPresence();
  if (document.activeElement === document.body) viewport.focus();
  flash(`Storage: ${store.kind}`);
});
