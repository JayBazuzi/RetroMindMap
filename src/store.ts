import { newRetroMap, MapNode, MapNodes, ROOT_ID } from "./mapModel";

export interface Presence {
  name: string;
  color: string;
  selectedId: string | null;
}

/** A peer's color, safe to put in CSS: anything but #rrggbb becomes gray. */
export function peerColor(p: Presence): string {
  return /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : "#868e96";
}

export interface MapStore {
  readonly kind: string;
  onNodes(cb: (nodes: MapNodes) => void): void;
  onPresence(cb: (others: Record<string, Presence>) => void): void;
  put(node: MapNode): void;
  update(id: string, fields: Partial<MapNode>): void;
  remove(ids: string[]): void;
  setPresence(p: Presence): void;
}

export const clientId = crypto.randomUUID().slice(0, 8);

export async function openStore(room: string): Promise<MapStore> {
  const env = import.meta.env;
  if (env.VITE_FIREBASE_DATABASE_URL) {
    const { FirebaseStore } = await import("./firebaseStore");
    return new FirebaseStore(room, {
      apiKey: env.VITE_FIREBASE_API_KEY,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      databaseURL: env.VITE_FIREBASE_DATABASE_URL,
    });
  }
  return new LocalStore(room);
}

type Message =
  | { type: "nodes" }
  | { type: "presence"; from: string; presence: Presence | null };

/**
 * No-backend fallback: persists to localStorage and syncs tabs of the same
 * browser over BroadcastChannel. Good for development and solo use.
 */
export class LocalStore implements MapStore {
  readonly kind = "local (this browser only)";
  private nodes: MapNodes;
  private others: Record<string, Presence> = {};
  private nodesCb: (n: MapNodes) => void = () => {};
  private presenceCb: (p: Record<string, Presence>) => void = () => {};
  private channel: BroadcastChannel;
  private key: string;

  constructor(room: string) {
    this.key = `retro-mind-map:${room}`;
    this.nodes = this.load();
    this.channel = new BroadcastChannel(this.key);
    this.channel.onmessage = (e: MessageEvent<Message>) => {
      if (e.data.type === "nodes") {
        this.nodes = this.load();
        this.nodesCb(this.nodes);
      } else {
        if (e.data.presence) this.others[e.data.from] = e.data.presence;
        else delete this.others[e.data.from];
        this.presenceCb({ ...this.others });
      }
    };
    addEventListener("beforeunload", () =>
      this.post({ type: "presence", from: clientId, presence: null }),
    );
  }

  private load(): MapNodes {
    try {
      const raw = localStorage.getItem(this.key);
      const nodes = raw ? (JSON.parse(raw) as MapNodes) : null;
      if (nodes?.[ROOT_ID]) return nodes;
    } catch {
      // fall through to a fresh map
    }
    return newRetroMap();
  }

  private post(m: Message) {
    this.channel.postMessage(m);
  }

  private commit() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.nodes));
    } catch {
      // storage unavailable; keep working in memory
    }
    this.nodesCb({ ...this.nodes });
    this.post({ type: "nodes" });
  }

  onNodes(cb: (nodes: MapNodes) => void) {
    this.nodesCb = cb;
    cb({ ...this.nodes });
  }

  onPresence(cb: (others: Record<string, Presence>) => void) {
    this.presenceCb = cb;
  }

  put(node: MapNode) {
    this.nodes[node.id] = node;
    this.commit();
  }

  update(id: string, fields: Partial<MapNode>) {
    if (!this.nodes[id]) return;
    this.nodes[id] = { ...this.nodes[id], ...fields };
    this.commit();
  }

  remove(ids: string[]) {
    for (const id of ids) if (id !== ROOT_ID) delete this.nodes[id];
    this.commit();
  }

  setPresence(presence: Presence) {
    this.post({ type: "presence", from: clientId, presence });
  }
}
