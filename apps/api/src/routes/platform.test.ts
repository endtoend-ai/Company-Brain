import { describe, expect, test } from "bun:test";
import { createApp } from "../app";

describe("platform api routes", () => {
  test("lists templates with demo walkthrough metadata", async () => {
    const app = createApp();
    const response = await app.request("/platform/templates");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.templates).toHaveLength(14);
    expect(body.templates[0].demo_walkthrough.sample_inputs.length).toBeGreaterThanOrEqual(2);
  });

  test("creates and processes a scenario through platform APIs", async () => {
    const app = createApp();
    const created = await app.request("/platform/scenarios", {
      method: "POST",
      body: JSON.stringify({
        template_id: "customer-360",
        name: "Northwind Labs renewal brief",
        visibility: "team",
        uploaded_files: [{ name: "Northwind Labs CRM.csv", text: "Customer profile" }]
      })
    });
    const createdBody = await created.json();

    expect(created.status).toBe(201);
    expect(createdBody.scenario.template_id).toBe("customer-360");
    expect(createdBody.task.scenario_id).toBe(createdBody.scenario.id);

    const processed = await app.request(`/platform/tasks/${createdBody.task.id}/process`, { method: "POST" });
    const processedBody = await processed.json();
    expect(processed.status).toBe(200);
    expect(processedBody.task.status).toBe("ready");

    const knowledge = await app.request("/platform/knowledge");
    const knowledgeBody = await knowledge.json();
    expect(knowledgeBody.objects.some((item: any) => item.scenario_id === createdBody.scenario.id)).toBe(true);
  });

  test("returns admin governance surfaces", async () => {
    const app = createApp();
    const response = await app.request("/platform/admin/templates");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.templates.length).toBeGreaterThanOrEqual(14);
    expect(body.templates[0].demo_readiness).toBeGreaterThanOrEqual(50);
  });

  test("returns masked admin integration settings", async () => {
    const originalAgentKey = process.env.AGENT_API_KEY;
    const originalEmbeddingKey = process.env.EMBEDDING_API_KEY;
    const originalMineruKey = process.env.MINERU_API_KEY;
    process.env.AGENT_API_KEY = "sk-test-agent-secret";
    process.env.EMBEDDING_API_KEY = "sk-test-embedding-secret";
    process.env.MINERU_API_KEY = "mineru-secret";
    try {
      const app = createApp();
      const response = await app.request("/platform/admin/settings");
      const body = await response.json();
      const serialized = JSON.stringify(body);

      expect(response.status).toBe(200);
      expect(body.settings.providers.length).toBeGreaterThanOrEqual(2);
      expect(body.settings.parsers[0].secrets[0].configured).toBe(true);
      expect(serialized).not.toContain("sk-test-agent-secret");
      expect(serialized).not.toContain("sk-test-embedding-secret");
      expect(serialized).not.toContain("mineru-secret");
    } finally {
      restoreEnv("AGENT_API_KEY", originalAgentKey);
      restoreEnv("EMBEDDING_API_KEY", originalEmbeddingKey);
      restoreEnv("MINERU_API_KEY", originalMineruKey);
    }
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
