import { describe, expect, test } from "vitest";
import { linkify, toLinkedHtml } from "../src/links";
import { emptyMap, makeChild, ROOT_ID, toOutlineHtml } from "../src/mapModel";

describe("linkify", () => {
  test("plain text has no links", () => {
    expect(linkify("just words")).toEqual([{ text: "just words" }]);
  });

  test("finds http and https URLs among text", () => {
    expect(linkify("see https://example.com/a?b=1#c and http://x.io")).toEqual([
      { text: "see " },
      {
        text: "https://example.com/a?b=1#c",
        href: "https://example.com/a?b=1#c",
      },
      { text: " and " },
      { text: "http://x.io", href: "http://x.io" },
    ]);
  });

  test("leaves trailing punctuation out of the URL", () => {
    for (const [input, url] of [
      ["Read https://a.com/x.", "https://a.com/x"],
      ["(https://a.com/x)", "https://a.com/x"],
      [
        "https://en.wikipedia.org/wiki/Foo_(bar)!",
        "https://en.wikipedia.org/wiki/Foo_(bar)",
      ],
      ["https://a.com/x?, ok", "https://a.com/x"],
    ]) {
      expect(linkify(input).find((p) => p.href)?.href).toBe(url);
    }
  });

  test("only http(s) becomes a link", () => {
    for (const text of [
      "javascript:alert(1)",
      "ftp://a.com",
      "file:///c:/x",
      "www.a.com",
    ]) {
      expect(linkify(text).some((p) => p.href)).toBe(false);
    }
  });
});

test("linked HTML escapes everything else", () => {
  expect(toLinkedHtml('<b>"hi"</b> & https://a.com/?q=<x>\nnext')).toBe(
    '&lt;b&gt;&quot;hi&quot;&lt;/b&gt; &amp; <a href="https://a.com/?q=">https://a.com/?q=</a>&lt;x&gt;<br>next',
  );
});

test("HTML outline nests lists and links URLs", () => {
  const m = emptyMap("Retro");
  const tools = makeChild(m, ROOT_ID, "tools");
  m[tools.id] = tools;
  const idea = makeChild(m, tools.id, "CI: https://ci.example.com");
  m[idea.id] = idea;
  expect(toOutlineHtml(m)).toBe(
    '<p><b>Retro</b></p><ul><li>tools<ul><li>CI: <a href="https://ci.example.com">https://ci.example.com</a></li></ul></li></ul>',
  );
});
