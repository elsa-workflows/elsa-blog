import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { postSchema } from "./content.mjs";
import { suggestTags } from "./taxonomy.mjs";

const policy = JSON.parse(await fs.readFile(new URL("../schemas/tags.schema.json", import.meta.url), "utf8"));
const post = {
  title: "Taxonomy validation fixture",
  slug: "taxonomy-validation-fixture",
  description: "A fixture for checking blog topic validation.",
  publishedAt: "2026-01-01",
  authors: ["sipke"],
  category: "Tutorial"
};

for (const status of ["draft", "published", "archived"]) {
  test(`${status} posts accept approved topics and reject invalid tag lists`, () => {
    for (const tag of policy.items.enum) {
      assert.equal(postSchema.safeParse({ ...post, status, tags: [tag] }).success, true);
    }
    assert.equal(postSchema.safeParse({ ...post, status, tags: policy.items.enum.slice(0, policy.maxItems) }).success, true);

    for (const tags of [
      [],
      ["one-off-topic"],
      ["dotnet"],
      ["elsa-workflows"],
      ["AI"],
      ["operations", "operations"],
      policy.items.enum.slice(0, policy.maxItems + 1)
    ]) {
      assert.equal(postSchema.safeParse({ ...post, status, tags }).success, false, JSON.stringify(tags));
    }
  });
}

test("headline suggestions cover representative imports without generic product tags", () => {
  assert.deepEqual(suggestTags("OpenID Connect in Elsa Studio"), ["security", "studio"]);
  assert.deepEqual(suggestTags("Orchestrating Intelligent Agents with Elsa Workflows"), ["ai", "workflow-runtime"]);
  assert.deepEqual(suggestTags("Building Workflow Driven .NET Applications"), ["workflow-authoring", "workflow-runtime"]);
  assert.deepEqual(suggestTags("Unclassified technical article"), ["architecture"]);
});

test("suggestions stay bounded and valid even when a headline names many topics", () => {
  const tags = suggestTags("Building Elsa 4: AI, secrets, persistence, logs, Studio, and workflow plugins");
  assert.equal(tags.length, policy.maxItems);
  assert.equal(postSchema.safeParse({ ...post, status: "draft", tags }).success, true);
});

test("the journal tag is limited to the named series and its introduction", () => {
  assert.ok(suggestTags("Building Elsa 4 · Week 2: How Domains Talk Without Touching").includes("devjournal"));
  assert.ok(suggestTags("Why Elsa 4? Rebuilding a .NET Workflow Engine from the Foundation Up").includes("devjournal"));
  assert.equal(suggestTags("Deployment lessons from Week 2").includes("devjournal"), false);
  assert.equal(suggestTags("Building Elsa 4 Modules Without Restarting").includes("devjournal"), false);
});
