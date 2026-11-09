# Decisions article verification

Article: [Business rules in Elsa 4: introducing Decisions](../../content/posts/2026-11-09-business-rules-in-elsa-4-introducing-decisions.md).

Prepared 9 November 2026. The owner authorized publication on Elsa Hub through Lovable, social sharing and a Medium edition. Publication receipts belong on the article PR and in the delivery response; this document records the source and asset boundaries of the article.

## Technical evidence

Source review used Foundation revision `fcbdc634e0d9e04e44491b6c29fde8d35c8b414d` and merged [PR #3689](https://github.com/elsa-workflows/elsa-foundation/pull/3689), merge `3ba0383f81095c41dcf8254253711fa053900ca2` on 6 November 2026. The local primary Foundation checkout was older and was not used to establish current behavior.

- [ADR 0095](https://github.com/elsa-workflows/elsa-foundation/blob/fcbdc634e0d9e04e44491b6c29fde8d35c8b414d/docs/adr/0095-decisions-owns-business-decision-semantics.md) separates business Decisions from Rules fact inference.
- [DMN profile](https://github.com/elsa-workflows/elsa-foundation/blob/fcbdc634e0d9e04e44491b6c29fde8d35c8b414d/specs/1195-business-decisions/contracts/dmn-profile.md) defines independent DMN 1.3 tables, supported scalar types, unary tests, literal outputs, five hit policies and refusal behavior. The article makes no full-DMN, full-FEEL or Camunda-compatibility claim.
- [Workflow Design adapter](https://github.com/elsa-workflows/elsa-foundation/blob/fcbdc634e0d9e04e44491b6c29fde8d35c8b414d/Extensions/Decisions/src/Workflows/Design/README.md) resolves version selection at publication and embeds the immutable decision.
- [Workflow Runtime adapter](https://github.com/elsa-workflows/elsa-foundation/blob/fcbdc634e0d9e04e44491b6c29fde8d35c8b414d/Extensions/Decisions/src/Workflows/Runtime/README.md) documents EvaluateDecision, its actual result/trace, and reuse of normal workflow execution mechanisms.
- [Execution receipt](https://github.com/elsa-workflows/elsa-foundation/blob/fcbdc634e0d9e04e44491b6c29fde8d35c8b414d/specs/1195-business-decisions/evidence/execution-receipt.json) records direct/native/Flowchart/BPMN parity and restart qualification. This writing task inspected existing implementation evidence; it did not rerun the Foundation suites or assert current broad production/provider qualification.
- [Standalone evaluator](https://github.com/elsa-workflows/elsa-foundation/blob/fcbdc634e0d9e04e44491b6c29fde8d35c8b414d/Extensions/Decisions/src/Elsa.Decisions/README.md) documents the independent .NET dependency boundary. The article does not announce a published package or a stable release.
- [OMG's DMN introduction](https://www.omg.org/dmn/) establishes the standard's complementary relationship with process modeling.

BPMN integration is an ordinary Elsa task binding to EvaluateDecision, followed by routing on returned data. Arbitrary vendor decisionRef import is explicitly outside the stated capability. Application examples are illustrative, not customer deployments or implementation claims about adjacent approval/task features.

## Screenshot provenance

Four original PNGs were copied unchanged from the retained Studio qualification artifact in [Actions run 42138348774](https://github.com/elsa-workflows/elsa-foundation/actions/runs/42138348774): artifact ID `13472099731`, name `studio-ux-dd398e51ff3f9ee1bd8268baffd90e39cfea45b7-1`, digest `sha256:33d8a9d44ffe2307ce77d94ada566753bc080286162ea87421ab8181d1378cd3`. The overall workflow conclusion was failure; using its retained captures does not claim otherwise. The article calls these development/qualification captures rather than newly captured live product behavior.

The source prefix is `results/journeys-business-decisions-authoring-and-explanations-desktop-`.

| Article asset | Original file | Visible claim |
| --- | --- | --- |
| `01-decision-table.png` | `light/decision-table.png` | Typed inputs/output, four table rules, Unique policy |
| `02-saved-cases.png` | `light/decision-cases.png` | Saved boundary/no-match cases; All cases passed |
| `03-published-version.png` | `light/decision-published.png` | Read-only version 1 and Clone to draft |
| `04-rule-explanation.png` | `dark/decision-explanation.png` | Finance result, rule 3 matched/selected, individual tests |

Root visually inspected each selected image. The sample policy names include automated-run suffixes and a local development backend address. No credentials, private customer records or personal user data appear. The unusually large explanation input is an exact-numeric development case, not a realistic purchase amount. No pixels or UI text were fabricated or retouched.

## Header artwork

The built-in image-generation tool created the header and then restyled it using the owner's attached reference. The selected workspace file is `content/assets/2026-11-09-business-rules-in-elsa-4-introducing-decisions/featured.png`, 1672 × 941, approximately 16:9. It is conceptual artwork and not a product screenshot.

Final prompt (built-in edit mode; first image was the original generated header, second was the owner's style reference):

> Use case: style-transfer. Edit target Image 1, the header illustration about a decision table shared by two workflows. Image 2 is the user's visual style reference ONLY. Improve Image 1 by matching the delicate, considered, technical sketchbook editorial style of Image 2: very fine gray graphite pencil outlines and visible light crosshatching, pale sage green / sky blue / soft peach watercolor washes, subtle natural cream paper grain, tiny dashed connectors with small open circular anchor marks, organized miniature diagrams with restrained handwritten horizontal strokes as symbolic content. Make it feel like a lovely illustrated engineering field guide rather than a loose children's watercolor. Reduce the oversized heavy blue shapes and the large gold seal. Compose two clearly distinct small native workflow/BPMN process diagrams, both connected by fine dashed lines to ONE prominent reusable decision table on the right. The table shows a blue/sage/peach header, simple diamond category symbols in first column, small checkmarks and horizontal strokes in cells. Across the lower portion show a small stack of policy sheets and a restrained smaller result arrow/checkmark, keeping these subordinate. Communicate reusable business decisions embedded in workflows; spacious, balanced, beautiful and precise. Wide landscape 16:9. Keep the entire drawing finely outlined and softly colored like Image 2, with enough central/top breathing room. Do not reproduce the logo or the text 'A look at Elsa 4' from reference image 2. No readable text, letters or numbers; no branding; no UI mockup. Preserve the concept from Image 1 while redesigning its composition and rendering to match Image 2.

## Verification and review scope

- `npm ci`, `npm run validate`, `npm run build`, and whitespace checks passed. No generated `dist/` artifacts are committed.
- The article's four inline relative image paths are supported by Hub's existing `absolutizeAssetUrls` handling and build-time prerenderer. The featured image resolves through the normal content pipeline.
- A standalone HTML/PDF preview was derived mechanically from the canonical Markdown for review. The preview's YAML adapter was corrected to avoid line-wrapping metadata before the skill renderer parses it; production blog metadata uses the repository's normal YAML parser.
- Browser preview verification covered desktop, tablet, mobile and dark mode. Final live publication checks must verify the Hub article, prerendered HTML, image responses and sitemap after Lovable publishes.
- Independent correctness, repository standards and editorial/acceptance reviews supplied input to root integration and QA. Requested Sol 5.6 is not selectable for the running root session; delegated work used the available `gpt-6-luna` at `xhigh`.
