import { describe, expect, test } from "vitest";
import { peerColor } from "../src/store";

describe("peerColor", () => {
  const presence = (color: unknown) =>
    ({ name: "Ann", color, selectedId: null }) as never;

  test("keeps a #rrggbb color", () => {
    expect(peerColor(presence("#1A2b3c"))).toBe("#1A2b3c");
  });

  test.each([
    "url(https://evil.example/x)",
    "red",
    "#fff",
    "#1a2b3c; background: url(x)",
    "",
    undefined,
    42,
  ])("replaces %j with gray", (color) => {
    expect(peerColor(presence(color))).toBe("#868e96");
  });
});
