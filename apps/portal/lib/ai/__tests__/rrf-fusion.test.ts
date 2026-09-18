import { fuseVectorAndKeywordResults } from "../rrf-fusion";

describe("Reciprocal Rank Fusion (RRF)", () => {
  it("fuses vector and keyword search results correctly", () => {
    const vectorResults = [
      { id: "doc-1", content: "High similarity document" },
      { id: "doc-2", content: "Medium similarity document" },
      { id: "doc-3", content: "Low similarity document" },
    ];

    const keywordResults = [
      { id: "doc-2", content: "Medium similarity document" },
      { id: "doc-4", content: "Keyword match document" },
      { id: "doc-1", content: "High similarity document" },
    ];

    const fused = fuseVectorAndKeywordResults(vectorResults, keywordResults, { k: 60 });

    expect(fused.length).toBe(4);

    // doc-1: vector rank 1, keyword rank 3 -> 1/(60+1) + 1/(60+3) = 0.016393 + 0.015873 = 0.032266
    // doc-2: vector rank 2, keyword rank 1 -> 1/(60+2) + 1/(60+1) = 0.016129 + 0.016393 = 0.032522
    // Therefore doc-2 should rank #1 fused result!

    expect(fused[0]?.item.id).toBe("doc-2");
    expect(fused[1]?.item.id).toBe("doc-1");

    expect(fused[0]?.vectorRank).toBe(2);
    expect(fused[0]?.keywordRank).toBe(1);
  });

  it("handles disjoint result lists gracefully", () => {
    const vectorResults = [{ id: "vec-1", content: "Vector only" }];
    const keywordResults = [{ id: "key-1", content: "Keyword only" }];

    const fused = fuseVectorAndKeywordResults(vectorResults, keywordResults);

    expect(fused.length).toBe(2);
    expect(fused[0]?.rrfScore).toBeCloseTo(1 / 61, 5);
    expect(fused[1]?.rrfScore).toBeCloseTo(1 / 61, 5);
  });
});
