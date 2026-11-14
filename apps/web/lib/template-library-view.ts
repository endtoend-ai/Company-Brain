export type TemplateLibraryView = "featured" | "grid" | "list" | "compare";

export type TemplateViewOption = {
  id: TemplateLibraryView;
  label: string;
  description: string;
};

/** Labels and descriptions are translation keys resolved at render time. */
export const templateViewOptions: TemplateViewOption[] = [
  { id: "featured", label: "templates.viewFeatured", description: "templates.viewFeaturedDescription" },
  { id: "grid", label: "templates.viewGrid", description: "templates.viewGridDescription" },
  { id: "list", label: "templates.viewList", description: "templates.viewListDescription" },
  { id: "compare", label: "templates.viewCompare", description: "templates.viewCompareDescription" }
];

export function getTemplateViewOption(value: string | null | undefined): TemplateViewOption {
  return templateViewOptions.find((option) => option.id === value) ?? templateViewOptions[0];
}
