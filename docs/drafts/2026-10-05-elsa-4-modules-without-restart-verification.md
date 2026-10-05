# Draft review notes

Article: [Updating Elsa 4 Modules Without Restarting the Host](../../content/posts/2026-10-05-elsa-4-modules-without-restart.md).

Prepared 5 October 2026. Status is `draft`; the frontmatter date is the required draft metadata field, not a publication claim. Local draft branch: `codex/elsa4-modules-without-restart-draft`, based on refreshed `origin/main` at `32f1799`. No push, PR, publication, merge, deployment or social sharing was performed. The pre-existing `.github/github-app.yml` remains untracked and untouched. No demo operation, reset, migration or process restart was performed during article preparation.

## Evidence reviewed

- Foundation source HEAD: `5be960a1becf8e2b2bd8c2bb09ab60aa182962b3`.
- Studio source HEAD: `c3be2553650e2158616bc874c97ad2b47077bd20`.
- Demo sources: `/Users/sipke/Documents/Codex/2026-10-03/modules-without-restart/output/TELEPROMPTER.md`, `output/EVIDENCE.md`, and `output/readiness-2026-10-05/README.md`.
- The 5 October readiness folder includes recorded actual browser evidence and a separate `api-rehearsal.json`. The latter reports 24/24 passed checks and unchanged PIDs/binary hashes during that measured update. Browser and API evidence are distinct. These are historical rehearsal observations, not a fresh live test in this writing task.
- The latest evidence records baseline restoration after rehearsal. The article describes the upgrade sequence rather than claiming a current live host state.

## Claim boundaries

| Claim | Evidence and limit |
| --- | --- |
| Host has no compiled Elsa feature implementations | `src/apps/Elsa.Foundation.Host/Elsa.Foundation.Host.csproj` at the Foundation revision above. Shared contract and host infrastructure references remain present. |
| Publish once; hosts install independently; installed differs from serving | Recorded 5 October browser walkthrough and API steps. The feed contains real packages. |
| Validate refuses missing migration and old release keeps serving | `src/essentials/Modularity/EntityFramework/EfPendingMigrationActivationGuard.cs` lines 203-237 invokes Validate and reports pending migrations; lines 281-286 directs out-of-process migration. Recorded HTTP 409 reload responses independently show the retained serving 1.0.0 shell. Applying migration and reloading shells remain explicit operations. |
| Optional premium, nullable numeric column, original rows retained | `samples/Elsa.Samples.Nuplane.Renewals/V2/Migrations/Renewals/Sqlite/20260929183423_AddProposedPremium.cs` lines 13-19; recorded row identities/timestamps and null premiums. |
| Mixed fleet keeps premium dormant | Recorded A 1.1.0 / B 1.0.0 state, premium HTTP 409, and CLI evidence of B's blocking active reader. `EfSchemaModuleGate.cs` lines 613-628 and 654-665 requires every counted member to read the target before finalization. The column exists while the family is still finalized at 1.0.0; only after reader compatibility does it advance to 2.0.0. `src/essentials/Cluster/InProcess/SchemaDormancyCheck.cs` lines 41-53 refuses unavailable feature use. |
| Old contract can use new implementation | Recorded untouched-contract completion and reexecution of a published original artifact; conditional on preserved compatible inputs and behavior. |
| Contract version does not bind an old binary | `src/essentials/Workflows/Publishing/Services/ClrActivityTypeResolver.cs` lines 15-25 and `src/essentials/Activities/Primitives/Activation/ClrActivityActivator.cs` lines 38-42 resolve by local alias. `src/essentials/Serialization/SystemText/Services/WellKnownTypeRegistry.cs` lines 18-19, 32-46 holds one Type per alias. [Issue #2312](https://github.com/elsa-workflows/elsa-foundation/issues/2312), checked open on 5 October, records the pinning gap and requests earlier missing-input diagnostics. |
| New contract sent to old worker can fail hydration | `src/essentials/Activities/Runtime/Services/ActivityInputHydrator.cs` lines 33-36 throws for a contract input without a corresponding annotated property. Source-confirmed; exact misrouting was not freshly live-tested. |
| Catalog refresh and node upgrade are explicit | Recorded Studio browser sequence; `useWorkflowEditorData.ts` lines 101-110, 143-146, `WorkflowEditor.tsx` lines 767-777, 1023-1032 and `InspectorPanel.tsx` lines 459-467. Catalog refresh preserved the original node; upgrading the selected occurrence exposed the new input. |

The demonstration uses SQLite. PostgreSQL migrations exist but were not exercised by this rehearsal. No universal zero-downtime, production-readiness, throughput, automatic routing, automatic migration, automatic node upgrade, side-by-side binary binding or in-flight-state migration claim is made. Issue #2312 is evidence of a current gap, not proof that either enhancement has been implemented or committed as a design.

## Writing and artwork

Applied the `write-humanized-elsa-posts` skill, its voice guide and header-image guide. Applied the writing-style skill's discovery workflow; its two searches returned no suitable technical-post reference. Style decisions therefore use the explicit user preferences and author-attributed repository posts inspected, including the 4 October human-approval post, 4 September development journal, suspended-workflow upgrade post and Nuplane introduction. No retrieved email substance was reused.

Header generated with the built-in image generation tool and visually reviewed. Workspace asset: `content/assets/2026-10-05-elsa-4-modules-without-restart/featured.png`, 1672 x 941 pixels, approximately 16:9. The illustration contains no readable labels, code, logos or brand marks; it is conceptual artwork rather than runtime evidence. Alt text is in frontmatter.

Generation prompt:

> Use case: stylized-concept. Create a 16:9 raster editorial header illustration for a practical technical article about updating modular workflow software while the host keeps running, with database compatibility controlling activation. One concrete visual metaphor: two compact, quietly illuminated modular machines on a matte workbench, joined to a shared stack of thin data layers; a replaceable warm amber component is suspended just above its matching slot in one machine, while an older blue component remains fitted in the other. A small mechanical alignment gate beside the shared layers suggests that components must fit before activation. Restrained architectural editorial illustration, subtle tactile surfaces, soft daylight, muted slate blue, stone and a single amber accent, clean composition, subtle depth, generous negative space in the upper third, no text, no readable words or numbers, no logos, no code, no UI, no brand marks, no people, no clouds, no neon grids, no glossy SaaS marketing. Aspect ratio exactly 16:9.

## Local checks and preview

- `npm ci` completed with the existing lockfile. The audit reports four existing high-severity dependency entries (`braces`, `micromatch`, `fast-glob`, `js-yaml`); no dependency or lockfile changes were made for this content task.
- `npm run validate` passed: 67 posts, one author.
- `npm run build` passed: 65 published posts and 65 detail artifacts.
- Draft exclusion checked in `dist/index.json`, RSS, sitemap and post JSON/HTML artifacts. The build copies header assets as usual, but emits no article artifact for this draft.
- Whitespace, prohibited identity strings and em/en dash scans passed on the deliverables. Header inspected visually.
- Private review preview uses the repository's existing HTML renderer with a draft banner and local image. It is outside `dist/` and outside public content assets: `/Users/sipke/.codex/visualizations/2026/10/05/01a10de8-bf99-7c81-835f-88de2c284f20/elsa-4-modules-without-restart-preview.html`.
- Loopback preview: `http://127.0.0.1:54406/elsa-4-modules-without-restart-preview.html`; available while its local preview server runs. It was opened and inspected in the actual in-app browser.

Source verification was delegated to `gpt-6-luna` with `xhigh` reasoning. Its returned review confirmed the claims and requested two refinements: distinguish physical migration from finalized schema version, and clarify that issue #2312 requests earlier diagnostics. Both were integrated; root independently read the host, migration, gate, dormancy, resolver, registry and hydrator sources. Final integration, claim review and repository QA remained with the root agent. Root model switching is not exposed in this session; the existing root model was retained.
