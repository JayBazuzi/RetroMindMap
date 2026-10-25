import { initializeApp, FirebaseOptions } from "firebase/app";
import {
  Database,
  getDatabase,
  onDisconnect,
  onValue,
  ref,
  set,
  update,
} from "firebase/database";
import { emptyMap, MapNode, MapNodes, ROOT_ID } from "./mapModel";
import { clientId, MapStore, Presence } from "./store";

/**
 * Layout in the Realtime Database:
 *   maps/<room>/nodes/<id>      = MapNode
 *   maps/<room>/presence/<cid>  = Presence (removed on disconnect)
 * Each node is its own key, so concurrent edits to different nodes never conflict.
 */
export class FirebaseStore implements MapStore {
  readonly kind = "shared (Firebase)";
  private db: Database;
  private base: string;

  constructor(room: string, options: FirebaseOptions) {
    this.db = getDatabase(initializeApp(options));
    this.base = `maps/${room}`;
    const me = ref(this.db, `${this.base}/presence/${clientId}`);
    onDisconnect(me).remove();
  }

  onNodes(cb: (nodes: MapNodes) => void) {
    onValue(ref(this.db, `${this.base}/nodes`), (snap) => {
      const nodes = (snap.val() ?? {}) as MapNodes;
      if (!nodes[ROOT_ID]) {
        const root = emptyMap()[ROOT_ID];
        set(ref(this.db, `${this.base}/nodes/${ROOT_ID}`), root);
        nodes[ROOT_ID] = root;
      }
      cb(nodes);
    });
  }

  onPresence(cb: (others: Record<string, Presence>) => void) {
    onValue(ref(this.db, `${this.base}/presence`), (snap) => {
      const all = (snap.val() ?? {}) as Record<string, Presence>;
      delete all[clientId];
      cb(all);
    });
  }

  put(node: MapNode) {
    set(ref(this.db, `${this.base}/nodes/${node.id}`), node);
  }

  update(id: string, fields: Partial<MapNode>) {
    const paths: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      paths[`nodes/${id}/${k}`] = v ?? null;
    }
    update(ref(this.db, this.base), paths);
  }

  remove(ids: string[]) {
    const paths: Record<string, null> = {};
    for (const id of ids) if (id !== ROOT_ID) paths[`nodes/${id}`] = null;
    update(ref(this.db, this.base), paths);
  }

  setPresence(p: Presence) {
    set(ref(this.db, `${this.base}/presence/${clientId}`), p);
  }
}
