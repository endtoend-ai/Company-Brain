import { describe, expect, test } from "bun:test";

import { assertSmokeAnswer, buildSmokeCases } from "./smoke-platform-scenario";

describe("platform real smoke script contract", () => {
  test("covers all three production RAG engines", () => {
    const cases = buildSmokeCases();

    expect(cases.map((item) => item.engine)).toEqual(["Gbrain", "Naive RAG", "GraphRAG"]);
    expect(cases.every((item) => item.fileName.length > 0)).toBe(true);
    expect(cases.every((item) => item.expectedAnswerHit.length > 0)).toBe(true);
  });

  test("requires real answer hits and citations", () => {
    expect(() => assertSmokeAnswer({
      engine: "Naive RAG",
      expectedAnswerHit: "$280",
      response: {
        answer: {
          engine: "Naive RAG",
          text: "The hotel cap is $280 per night.",
          citations: [{ excerpt: "The hotel cap in San Francisco is $280 per night." }]
        }
      }
    })).not.toThrow();

    expect(() => assertSmokeAnswer({
      engine: "GraphRAG",
      expectedAnswerHit: "integration risk",
      response: {
        answer: {
          engine: "GraphRAG",
          text: "No results found.",
          citations: []
        }
      }
    })).toThrow("GraphRAG smoke did not return citations");
  });
});
