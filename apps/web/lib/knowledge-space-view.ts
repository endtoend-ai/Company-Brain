import type { KnowledgeSpaceObject, Visibility } from "./fixtures/frontstage";

export type KnowledgeAssetScope = "all" | Visibility;
export type KnowledgeAssetKind = KnowledgeSpaceObject["mode"];
export type KnowledgeAssetKindFilter = "all" | KnowledgeAssetKind;

export type KnowledgeAssetFilters = {
  scope: KnowledgeAssetScope;
  kind: KnowledgeAssetKindFilter;
  query: string;
};

export type KnowledgeAssetStats = {
  total: number;
  private: number;
  team: number;
  company: number;
  wiki: number;
  document: number;
  relationship: number;
  artifact: number;
};

export const knowledgeAssetScopes: Array<{ id: KnowledgeAssetScope; label: string; description: string }> = [
  { id: "all", label: "All access", description: "View the personal, team, and company knowledge this account can see." },
  { id: "private", label: "Personal knowledge", description: "Retrievable only by the creator and admins." },
  { id: "team", label: "Team knowledge", description: "Available to team members inside business scenarios." },
  { id: "company", label: "Company knowledge", description: "Enters company-wide Q&A after publish review." }
];

export const knowledgeAssetKinds: Array<{ id: KnowledgeAssetKindFilter; label: string; description: string }> = [
  { id: "all", label: "All types", description: "View every retrievable knowledge asset in one place." },
  { id: "document", label: "Document evidence", description: "Source evidence from PDFs, Word files, spreadsheets, policies, and contracts." },
  { id: "relationship", label: "Knowledge graph", description: "Customer, people, supplier, event, and risk relationships." },
  { id: "wiki", label: "Knowledge wiki", description: "Settled wiki pages, handbooks, fact cards, and reusable conclusions." },
  { id: "artifact", label: "Business artifacts", description: "Reports, meeting notes, review results, and downloadable deliverables." }
];

export function knowledgeModeLabel(mode: KnowledgeAssetKind) {
  const labels: Record<KnowledgeAssetKind, string> = {
    wiki: "Knowledge wiki",
    document: "Document evidence",
    relationship: "Knowledge graph",
    artifact: "Business artifacts"
  };
  return labels[mode];
}

export function knowledgeVisibilityLabel(visibility: Visibility) {
  const labels: Record<Visibility, string> = {
    private: "Private",
    team: "Team",
    company: "Company"
  };
  return labels[visibility];
}

export function buildKnowledgeAssetStats(objects: KnowledgeSpaceObject[]): KnowledgeAssetStats {
  return objects.reduce<KnowledgeAssetStats>((stats, object) => {
    stats.total += 1;
    stats[object.visibility] += 1;
    stats[object.mode] += 1;
    return stats;
  }, { total: 0, private: 0, team: 0, company: 0, wiki: 0, document: 0, relationship: 0, artifact: 0 });
}

export function filterKnowledgeAssets(objects: KnowledgeSpaceObject[], filters: KnowledgeAssetFilters) {
  const query = filters.query.trim().toLowerCase();
  return objects.filter((object) => {
    if (filters.scope !== "all" && object.visibility !== filters.scope) return false;
    if (filters.kind !== "all" && object.mode !== filters.kind) return false;
    if (!query) return true;
    return [object.title, object.summary, object.sourceLabel, object.owner, knowledgeModeLabel(object.mode), knowledgeVisibilityLabel(object.visibility)]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
}

export function knowledgeGovernanceActions(object: KnowledgeSpaceObject) {
  const actions = ["Open scenario", "View source", "Request update"];
  if (object.visibility === "private") return [...actions, "Request team sharing"];
  if (object.visibility === "team") return [...actions, "Request company publish"];
  return [...actions, "View retrieval scope"];
}

export function knowledgeAssetRiskNote(object: KnowledgeSpaceObject) {
  if (object.visibility === "private") return "Personal knowledge is never retrieved by team or company scenarios; keep drafts, personal files, and unpublished material here.";
  if (object.visibility === "team") return "Team knowledge is retrieved only inside team scenarios; the owner must confirm the source boundary before publishing to company level.";
  return "Company knowledge is retrievable in company-wide Q&A and must keep sources, review records, and traceable citations.";
}
