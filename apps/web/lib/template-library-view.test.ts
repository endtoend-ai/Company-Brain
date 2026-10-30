import { describe, expect, test } from "bun:test";

import { getTemplateViewOption, templateViewOptions } from "./template-library-view";

describe("template library view options", () => {
  test("offers distinct browsing modes for choosing a solution template", () => {
    expect(templateViewOptions.map((option) => option.id)).toEqual(["featured", "grid", "list", "compare"]);
    expect(templateViewOptions.map((option) => option.label)).toEqual(["Featured", "Grid", "List", "Compare"]);
    expect(templateViewOptions.every((option) => option.description.length > 0)).toBe(true);
  });

  test("falls back to featured mode for unknown query values", () => {
    expect(getTemplateViewOption("compare").label).toBe("Compare");
    expect(getTemplateViewOption("unknown").id).toBe("featured");
    expect(getTemplateViewOption(null).id).toBe("featured");
  });
});
