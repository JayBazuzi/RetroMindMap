import { expect, test } from "vitest";
import { greeting } from "../src/greeting";

test("greeting", () => {
  expect(greeting("World")).toBe("Hello, World!");
});
