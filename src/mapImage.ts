import { Box } from "./layout";
import { MapNodes } from "./mapModel";

const MARGIN = 32;
const SCALE = 2;

/**
 * Draws the whole map onto a canvas, copying each node's look from its
 * on-screen element, on a white background so it pastes well anywhere.
 */
export function drawMap(
  nodes: MapNodes,
  boxes: Record<string, Box>,
  elements: Map<string, HTMLElement>,
  colorOf: (id: string) => string,
): HTMLCanvasElement {
  const placed = Object.values(nodes).filter((n) => boxes[n.id]);
  const left = Math.min(
    ...placed.map((n) => boxes[n.id].x - boxes[n.id].width / 2),
  );
  const right = Math.max(
    ...placed.map((n) => boxes[n.id].x + boxes[n.id].width / 2),
  );
  const top = Math.min(
    ...placed.map((n) => boxes[n.id].y - boxes[n.id].height / 2),
  );
  const bottom = Math.max(
    ...placed.map((n) => boxes[n.id].y + boxes[n.id].height / 2),
  );

  const canvas = document.createElement("canvas");
  canvas.width = (right - left + 2 * MARGIN) * SCALE;
  canvas.height = (bottom - top + 2 * MARGIN) * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(MARGIN - left, MARGIN - top);

  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  for (const node of placed) {
    const box = boxes[node.id];
    const parent = node.parentId ? boxes[node.parentId] : undefined;
    if (!parent) continue;
    const dir = box.side === "right" ? 1 : -1;
    const x1 = parent.x + (dir * parent.width) / 2;
    const x2 = box.x - (dir * box.width) / 2;
    const mx = (x1 + x2) / 2;
    ctx.strokeStyle = colorOf(node.id);
    ctx.beginPath();
    ctx.moveTo(x1, parent.y);
    ctx.bezierCurveTo(mx, parent.y, mx, box.y, x2, box.y);
    ctx.stroke();
  }

  for (const node of placed) {
    const box = boxes[node.id];
    const style = getComputedStyle(elements.get(node.id)!);
    const border = parseFloat(style.borderTopWidth);
    const x = box.x - box.width / 2;
    const y = box.y - box.height / 2;
    ctx.beginPath();
    ctx.roundRect(
      x + border / 2,
      y + border / 2,
      box.width - border,
      box.height - border,
      parseFloat(style.borderTopLeftRadius),
    );
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = border;
    ctx.strokeStyle = colorOf(node.id);
    ctx.stroke();

    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ctx.fillStyle = "#212529";
    ctx.textBaseline = "middle";
    const padX = parseFloat(style.paddingLeft) + border;
    const lineHeight = parseFloat(style.lineHeight);
    const lines = wrap(ctx, node.text, box.width - 2 * padX);
    let ly = box.y - ((lines.length - 1) * lineHeight) / 2;
    for (const line of lines) {
      ctx.fillText(line, x + padX, ly);
      ly += lineHeight;
    }
  }
  return canvas;
}

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      // Small tolerance: canvas and DOM measure text slightly differently.
      if (line && ctx.measureText(candidate).width > width + 2) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function copyMapImage(canvas: HTMLCanvasElement): Promise<void> {
  // Hand the clipboard a promise so the write stays inside the click gesture.
  const png = new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("no image"))),
      "image/png",
    ),
  );
  return navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}
