import { describe, expect, test } from "bun:test";

import { getTemplateViewOption, templateViewOptions } from "./template-library-view";
import { en } from "./i18n/dictionaries/en";
import { translate } from "./i18n";

const t = (key: string) => translate(en, key);

describe("template library view options", () => {
  test("offers distinct browsing modes for choosing a solution template", () => {
    expect(templateViewOptions.map((option) => option.id)).toEqual(["featured", "grid", "list", "compare"]);
    expect(templateViewOptions.map((option) => t(option.label))).toEqual(["Featured", "Grid", "List", "Compare"]);
    expect(templateViewOptions.every((option) => option.description.length > 0)).toBe(true);
    expect(templateViewOptions.every((option) => option.label.startsWith("templates."))).toBe(true);
  });

  test("falls back to featured mode for unknown query values", () => {
    expect(t(getTemplateViewOption("compare").label)).toBe("Compare");
    expect(getTemplateViewOption("unknown").id).toBe("featured");
    expect(getTemplateViewOption(null).id).toBe("featured");
  });
});
