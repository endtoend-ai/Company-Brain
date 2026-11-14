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

/** Labels and descriptions are translation keys resolved at render time. */
export const knowledgeAssetScopes: Array<{ id: KnowledgeAssetScope; label: string; description: string }> = [
  { id: "all", label: "knowledge.scopeAllLabel", description: "knowledge.scopeAllDescription" },
  { id: "private", label: "knowledge.scopePrivateLabel", description: "knowledge.scopePrivateDescription" },
  { id: "team", label: "knowledge.scopeTeamLabel", description: "knowledge.scopeTeamDescription" },
  { id: "company", label: "knowledge.scopeCompanyLabel", description: "knowledge.scopeCompanyDescription" }
];

export const knowledgeAssetKinds: Array<{ id: KnowledgeAssetKindFilter; label: string; description: string }> = [
  { id: "all", label: "knowledge.kindAllLabel", description: "knowledge.kindAllDescription" },
  { id: "document", label: "knowledge.modeDocument", description: "knowledge.kindDocumentDescription" },
  { id: "relationship", label: "knowledge.modeRelationship", description: "knowledge.kindRelationshipDescription" },
  { id: "wiki", label: "knowledge.modeWiki", description: "knowledge.kindWikiDescription" },
  { id: "artifact", label: "knowledge.modeArtifact", description: "knowledge.kindArtifactDescription" }
];

export function knowledgeModeLabel(mode: KnowledgeAssetKind) {
  const keys: Record<KnowledgeAssetKind, string> = {
    wiki: "knowledge.modeWiki",
    document: "knowledge.modeDocument",
    relationship: "knowledge.modeRelationship",
    artifact: "knowledge.modeArtifact"
  };
  return keys[mode];
}

export function knowledgeVisibilityLabel(visibility: Visibility) {
  const keys: Record<Visibility, string> = {
    private: "visibility.private",
    team: "visibility.team",
    company: "visibility.company"
  };
  return keys[visibility];
}

export function buildKnowledgeAssetStats(objects: KnowledgeSpaceObject[]): KnowledgeAssetStats {
  return objects.reduce<KnowledgeAssetStats>((stats, object) => {
    stats.total += 1;
    stats[object.visibility] += 1;
    stats[object.mode] += 1;
    return stats;
  }, { total: 0, private: 0, team: 0, company: 0, wiki: 0, document: 0, relationship: 0, artifact: 0 });
}

/**
 * `translate` lets the search box match the labels the user actually sees;
 * without it only stored data is matched.
 */
export function filterKnowledgeAssets(
  objects: KnowledgeSpaceObject[],
  filters: KnowledgeAssetFilters,
  translate?: (key: string) => string
) {
  const query = filters.query.trim().toLowerCase();
  const label = translate ?? ((key: string) => key);
  return objects.filter((object) => {
    if (filters.scope !== "all" && object.visibility !== filters.scope) return false;
    if (filters.kind !== "all" && object.mode !== filters.kind) return false;
    if (!query) return true;
    return [
      object.title,
      object.summary,
      object.sourceLabel,
      object.owner,
      label(knowledgeModeLabel(object.mode)),
      label(knowledgeVisibilityLabel(object.visibility))
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
}

export function knowledgeGovernanceActions(object: KnowledgeSpaceObject) {
  const actions = [
    "knowledge.actionOpenScenario",
    "knowledge.actionViewSource",
    "knowledge.actionRequestUpdate"
  ];
  if (object.visibility === "private") return [...actions, "knowledge.actionRequestTeamSharing"];
  if (object.visibility === "team") return [...actions, "knowledge.actionRequestCompanyPublish"];
  return [...actions, "knowledge.actionViewRetrievalScope"];
}

export function knowledgeAssetRiskNote(object: KnowledgeSpaceObject) {
  if (object.visibility === "private") return "knowledge.riskPrivate";
  if (object.visibility === "team") return "knowledge.riskTeam";
  return "knowledge.riskCompany";
}
