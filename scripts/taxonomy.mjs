import fs from "node:fs/promises";
import { z } from "zod";

const policy = JSON.parse(await fs.readFile(new URL("../schemas/tags.schema.json", import.meta.url), "utf8"));

export const tagSchema = z.array(z.enum(policy.items.enum))
  .min(policy.minItems)
  .max(policy.maxItems)
  .refine((tags) => new Set(tags).size === tags.length, "Tags must be unique");

// Use the headline rather than incidental mentions in the article body.
// Imported suggestions still need editorial review before publication.
const topicRules = [
  ["devjournal", /^building elsa 4\s*[·:-]\s*week \d+\b|^why elsa 4\?\s*rebuilding/i],
  ["ai", /\bai\b|intelligent agents?|agent framework|weaver/i],
  ["security", /security|secrets?|openid|open id|identity|permissions?|roles?|tenant/i],
  ["persistence", /persist|databases?|storage|serializ|groundwork/i],
  ["operations", /logs?|logging|telemetry|diagnostics?|deploy|upgrad|docker|kubernetes|service bus/i],
  ["studio", /studio|dashboard/i],
  ["extensibility", /extensib|custom activit|modul|plugins?|nuplane|nuget/i],
  ["workflow-authoring", /workflow.driven|workflow author|approvals?|expressions?|bpmn|templates?|triggers?/i],
  ["workflow-runtime", /workflow|orchestrat|scheduled|replay|checkpoints?/i],
  ["architecture", /architect|cshells|nativeendpoints/i]
];

export function suggestTags(title) {
  const tags = topicRules
    .filter(([, pattern]) => pattern.test(title))
    .map(([tag]) => tag)
    .slice(0, policy.maxItems);

  return tagSchema.parse(tags.length ? tags : ["architecture"]);
}
