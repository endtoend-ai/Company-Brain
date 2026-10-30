import { describe, expect, test } from "bun:test";
import { answerFor, taskForAction } from "./chat";

describe("chat-first task actions", () => {
  test("relation answers expose a business task action", () => {
    const answer = answerFor("Is Northwind Labs worth renewing?");

    expect(answer.actions?.map((item) => item.label)).toContain("Generate the renewal risk brief");
    expect(answer.actions?.[0].taskId).toBe("renewal-brief");
  });

  test("task canvas has ordered steps and a reusable artifact", () => {
    const task = taskForAction("renewal-brief");

    expect(task?.title).toBe("Renewal risk brief");
    expect(task?.steps.map((step) => step.title)).toEqual(["Confirm the customer", "Collect evidence", "Generate the draft", "Save the deliverable"]);
    expect(task?.artifact.title).toContain("Northwind Labs");
  });
});
