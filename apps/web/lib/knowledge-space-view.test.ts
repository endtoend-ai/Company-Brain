import { describe, expect, test } from "bun:test";

import type { KnowledgeSpaceObject } from "./fixtures/frontstage";
import {
  buildKnowledgeAssetStats,
  filterKnowledgeAssets,
  knowledgeAssetRiskNote,
  knowledgeGovernanceActions,
  knowledgeModeLabel,
  knowledgeVisibilityLabel
} from "./knowledge-space-view";

const objects: KnowledgeSpaceObject[] = [
  {
    id: "doc-1",
    mode: "document",
    title: "Contract review evidence",
    summary: "Contract terms, risk list, and clause citations.",
    sourceLabel: "contract.pdf",
    linkedScenarioId: "scenario-1",
    visibility: "company",
    owner: "Legal",
    permissionNote: "Company file",
    updatedAt: "Today",
    actions: []
  },
  {
    id: "graph-1",
    mode: "relationship",
    title: "Customer relationship graph",
    summary: "Customers, sales, opportunities, and risk relationships.",
    sourceLabel: "crm.csv",
    linkedScenarioId: "scenario-2",
    visibility: "team",
    owner: "Sales",
    permissionNote: "Team file",
    updatedAt: "Yesterday",
    actions: []
  },
  {
    id: "wiki-1",
    mode: "wiki",
    title: "Personal sales notes",
    summary: "Private notes and retrospectives.",
    sourceLabel: "notes.md",
    linkedScenarioId: "scenario-3",
    visibility: "private",
    owner: "Maya Chen",
    permissionNote: "Personal file",
    updatedAt: "just now",
    actions: []
  }
];

describe("knowledge space view model", () => {
  test("labels RAG-backed asset types and permission scopes in product language", () => {
    expect(knowledgeModeLabel("document")).toBe("Document evidence");
    expect(knowledgeModeLabel("relationship")).toBe("Knowledge graph");
    expect(knowledgeVisibilityLabel("company")).toBe("Company");
  });

  test("builds stats for scopes and asset types", () => {
    expect(buildKnowledgeAssetStats(objects)).toMatchObject({
      total: 3,
      private: 1,
      team: 1,
      company: 1,
      document: 1,
      relationship: 1,
      wiki: 1
    });
  });

  test("filters by scope, asset type and search query", () => {
    expect(filterKnowledgeAssets(objects, { scope: "team", kind: "all", query: "" }).map((object) => object.id)).toEqual(["graph-1"]);
    expect(filterKnowledgeAssets(objects, { scope: "all", kind: "document", query: "contract" }).map((object) => object.id)).toEqual(["doc-1"]);
    expect(filterKnowledgeAssets(objects, { scope: "all", kind: "all", query: "sales" }).map((object) => object.id)).toEqual(["graph-1", "wiki-1"]);
  });

  test("exposes governance actions according to permission boundary", () => {
    expect(knowledgeGovernanceActions(objects[0])).toContain("View retrieval scope");
    expect(knowledgeGovernanceActions(objects[1])).toContain("Request company publish");
    expect(knowledgeGovernanceActions(objects[2])).toContain("Request team sharing");
    expect(knowledgeAssetRiskNote(objects[0])).toContain("company-wide Q&A");
  });
});
