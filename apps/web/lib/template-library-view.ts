export type TemplateLibraryView = "featured" | "grid" | "list" | "compare";

export type TemplateViewOption = {
  id: TemplateLibraryView;
  label: string;
  description: string;
};

export const templateViewOptions: TemplateViewOption[] = [
  {
    id: "featured",
    label: "Featured",
    description: "Leads with recommended templates, their best-fit scenarios, and the creation path; best for a first choice."
  },
  {
    id: "grid",
    label: "Grid",
    description: "Browse every template as cards to compare business themes and required inputs."
  },
  {
    id: "list",
    label: "List",
    description: "Scan category, setup time, file types, and outputs at higher information density."
  },
  {
    id: "compare",
    label: "Compare",
    description: "Compare best-fit work, accepted files, outputs, and review requirements side by side."
  }
];

export function getTemplateViewOption(value: string | null | undefined): TemplateViewOption {
  return templateViewOptions.find((option) => option.id === value) ?? templateViewOptions[0];
}
