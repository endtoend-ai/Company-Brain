import { describe, expect, test } from "bun:test";

import type { KnowledgeSpaceObject } from "./fixtures/frontstage";
import { en } from "./i18n/dictionaries/en";
import { translate } from "./i18n";
import {
  buildKnowledgeAssetStats,
  filterKnowledgeAssets,
  knowledgeAssetRiskNote,
  knowledgeGovernanceActions,
  knowledgeModeLabel,
  knowledgeVisibilityLabel
} from "./knowledge-space-view";

const t = (key: string) => translate(en, key);

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
    expect(t(knowledgeModeLabel("document"))).toBe("Document evidence");
    expect(t(knowledgeModeLabel("relationship"))).toBe("Knowledge graph");
    expect(t(knowledgeVisibilityLabel("company"))).toBe("Company");
  });

  test("returns translation keys rather than hardcoded copy", () => {
    expect(knowledgeModeLabel("document")).toBe("knowledge.modeDocument");
    expect(knowledgeVisibilityLabel("company")).toBe("visibility.company");
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
    expect(filterKnowledgeAssets(objects, { scope: "team", kind: "all", query: "" }, t).map((object) => object.id)).toEqual(["graph-1"]);
    expect(filterKnowledgeAssets(objects, { scope: "all", kind: "document", query: "contract" }, t).map((object) => object.id)).toEqual(["doc-1"]);
    expect(filterKnowledgeAssets(objects, { scope: "all", kind: "all", query: "sales" }, t).map((object) => object.id)).toEqual(["graph-1", "wiki-1"]);
    expect(filterKnowledgeAssets(objects, { scope: "all", kind: "all", query: "document evidence" }, t).map((object) => object.id)).toEqual(["doc-1"]);
  });

  test("exposes governance actions according to permission boundary", () => {
    expect(knowledgeGovernanceActions(objects[0]).map(t)).toContain("View retrieval scope");
    expect(knowledgeGovernanceActions(objects[1]).map(t)).toContain("Request company publish");
    expect(knowledgeGovernanceActions(objects[2]).map(t)).toContain("Request team sharing");
    expect(t(knowledgeAssetRiskNote(objects[0]))).toContain("company-wide Q&A");
  });
});
