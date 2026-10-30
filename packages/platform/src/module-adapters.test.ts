import { describe, expect, test } from "bun:test";
import {
  buildCreateSourceRequest,
  ingestTextIntoMockModule,
  platformReferenceFromIngestResult,
  platformReferenceFromRealResponse,
  resolveModuleExecutionMode
} from "./module-adapters";

describe("module adapters", () => {
  test("resolves execution mode with mock as the local default", () => {
    expect(resolveModuleExecutionMode({})).toBe("mock");
    expect(resolveModuleExecutionMode({ PLATFORM_MODULE_MODE: "real" })).toBe("real");
    expect(() => resolveModuleExecutionMode({ PLATFORM_MODULE_MODE: "fixture" })).toThrow("PLATFORM_MODULE_MODE");
  });

  test("builds module-specific source creation requests", () => {
    expect(buildCreateSourceRequest("graph-rag", "scenario/customer-360", "customer relationship material")).toEqual({
      moduleId: "graph-rag",
      body: {
        name: "scenario/customer-360",
        description: "customer relationship material",
        kind: "private"
      }
    });
  });

  test("mock ingest returns deterministic module object references", () => {
    const result = ingestTextIntoMockModule({
      moduleId: "traditional-rag",
      ingestMode: "traditional_document",
      sourceId: "source_1",
      file: { name: "policy.pdf", text: "policy body" }
    });

    expect(result.status).toBe("submitted");
    expect(result.moduleObjectId).toContain("traditional-rag");
    expect(result.objectKind).toBe("job");
  });

  test("mock and real ingest responses normalize to the same platform reference shape", () => {
    const mock = ingestTextIntoMockModule({
      moduleId: "traditional-rag",
      ingestMode: "traditional_document",
      sourceId: "source_1",
      file: { name: "policy.pdf", text: "policy" }
    });

    expect(platformReferenceFromIngestResult({
      moduleId: "traditional-rag",
      ingestMode: "traditional_document",
      sourceId: "source_1",
      result: mock
    })).toEqual({
      moduleId: "traditional-rag",
      sourceId: "source_1",
      moduleObjectId: mock.moduleObjectId,
      objectKind: "job",
      status: "submitted"
    });

    expect(platformReferenceFromRealResponse({
      moduleId: "graph-rag",
      ingestMode: "graph_document",
      sourceId: "graph_source_1",
      body: { document_id: "graph_document_1", status: "ready" }
    })).toEqual({
      moduleId: "graph-rag",
      sourceId: "graph_source_1",
      moduleObjectId: "graph_document_1",
      objectKind: "document",
      status: "ready"
    });
  });
});
