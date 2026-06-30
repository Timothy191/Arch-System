import { normalizeSearchQuery, escapeIlike } from "./query";

describe("search query helpers", () => {
  it("normalizes whitespace", () => {
    expect(normalizeSearchQuery("  drilling   ops ")).toBe("drilling ops");
  });

  it("escapes ilike wildcards", () => {
    expect(escapeIlike("100%")).toBe("100\\%");
    expect(escapeIlike("a_b")).toBe("a\\_b");
  });
});
