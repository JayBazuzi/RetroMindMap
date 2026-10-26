# Retro Mind Map REST Access

How to read and write a Retro Mind Map board with plain HTTP calls to its Firebase Realtime Database. No login or SDK is needed.

## Finding the board

A board link looks like `https://jay.bazuzi.com/RetroMindMap/#2026-10-25-3f9a1c2b7d4e`. The part after `#` is the **room**. It matches `^[A-Za-z0-9_-]{4,64}$`.

```sh
DB=https://retro-mind-map-default-rtdb.firebaseio.com
ROOM=2026-10-25-3f9a1c2b7d4e
```

You can only reach a room if you know its id. Listing all rooms (`GET $DB/maps.json`) is denied.

## Reading

```sh
curl -s "$DB/maps/$ROOM/nodes.json"
```

The response is a flat object of nodes keyed by id. It is `null` if nobody has opened the room yet. Rebuild the tree from `parentId`, and sort siblings by `order`, then by `id`.

```json
{
  "root": { "id": "root", "text": "2026-10-25\nSprint 12", "order": 0 },
  "peddles-tools": {
    "id": "peddles-tools",
    "parentId": "root",
    "text": "tools",
    "order": 2,
    "side": "right",
    "color": 2
  },
  "a1b2c3d4": {
    "id": "a1b2c3d4",
    "parentId": "peddles-tools",
    "text": "CI got faster",
    "order": 0
  }
}
```

Who is online, with what selected: `GET $DB/maps/$ROOM/presence.json`.

## Node fields

| Field      | Rule                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------- |
| `id`       | Required. Must equal the node's key. 1–64 of `A-Z a-z 0-9 _ -`. The app uses 8 hex chars. |
| `parentId` | Required on every node except `root`. The root must not have one.                         |
| `text`     | Required string, up to 1000 chars. `\n` makes a line break. URLs become links.            |
| `order`    | Required number. Sorts siblings and may be fractional.                                    |
| `side`     | `"left"` or `"right"`. Only used on children of `root`.                                   |
| `color`    | Branch color index 0–7. Only used on children of `root`.                                  |

The server rejects any other field and any node that breaks these rules.

## Writing

Add or change a node by writing only its own key, so you don't overwrite what other people are typing at the same moment.

**Add a child.** Make a new id, and set `order` to the largest sibling `order` + 1 (0 if there are no siblings). To insert between two siblings, use the average of their `order` values.

```sh
curl -s -X PUT "$DB/maps/$ROOM/nodes/e5f6a7b8.json" \
  -d '{"id":"e5f6a7b8","parentId":"peddles-tools","text":"Flaky e2e test","order":1}'
```

For a new top-level branch (parent `root`), also set `side` to whichever side has fewer branches, and `color` to the least-used index 0–7.

**Edit fields** by patching the node:

```sh
curl -s -X PATCH "$DB/maps/$ROOM/nodes/e5f6a7b8.json" -d '{"text":"Flaky e2e test (fixed)"}'
```

**Move a node** by patching its `parentId` and `order`. Don't move a node under its own descendant.

**Delete a node** together with all of its descendants in one multi-path patch. Nodes whose parent is gone become orphans, which the app shows as fragments.

```sh
curl -s -X PATCH "$DB/maps/$ROOM/nodes.json" -d '{"e5f6a7b8":null,"c9d0e1f2":null}'
```

## Cautions

- **Never PUT the whole `nodes` object.** That replaces the board and discards anyone else's concurrent edits.
- Never delete `root`. A missing root makes the next client to open the room reset it to a fresh PEDDLES map.
- Changes show up live for everyone who has the board open. There is no undo, so read the board again after you write.
- Anyone with the room id can do all of this. Don't put a room id anywhere public.
- On Windows, run the curl calls in Git Bash. PowerShell mangles the single-quoted JSON. You can also use `-d @body.json`.
