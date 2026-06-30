# Intro Post Outline — "Why Elsa 4? Rebuilding a Workflow Engine from the Foundation Up"

**Series:** Building Elsa 4 (Post 0 — the kickoff)
**Status:** Outline ready for writing
**Primary sources:** all verified in `elsa-foundation` repo (read-only) on 2026-06-30

> This is the anchor post of the whole series. It sets the premise: *why* Elsa 3
> (`elsa-core`) needed a foundational rebuild, *what* Elsa 4 (Foundation) does
> differently, and *how* the project is being built in the open. Every later
> weekly post is a waypoint on the road this post lays out.

---

## Target parameters

- **Primary keyword:** "Elsa Workflows 4" / "Elsa 4"
- **Secondary:** ".NET workflow engine", "modular monolith .NET", "workflow engine architecture", "spec-driven development"
- **Audience:** .NET developers, software architects, existing Elsa 3 users
- **Intent:** Informational (orientation + vision), with light commercial undertone (why follow/adopt)
- **Word count:** 2,000-2,500 (this one earns the length; it's the pillar)
- **Template:** thought-leadership × architecture deep-dive
- **Tone:** honest builder's manifesto — not a launch announcement; Elsa 4 is *in active development*

---

## Title options

1. **"Why Elsa 4? Rebuilding a .NET Workflow Engine from the Foundation Up"** (primary)
2. "Elsa 3 → Elsa 4: What We Learned Maintaining a Workflow Engine, and Why We Started Over"
3. "Building Elsa 4 in the Open: The Case for a Thin Foundation"

## Meta description (draft)

> Elsa 4 (codename Foundation) is a ground-up rebuild of the Elsa .NET workflow
> engine. Here's why elsa-core's architecture hit its limits — and the thin,
> modular, spec-driven foundation replacing it.

---

## Key Takeaways box (place after the hook)

> **Key takeaways**
> - Elsa 4 ("Elsa Foundation") is a foundational rebuild, not a feature release — it began **2026-05-08**.
> - It's a response to seven concrete structural problems in `elsa-core`, documented as a case study, not blamed on the team.
> - The guiding principle: a **thin protocol, not a fat platform** — modules are opt-in, coupling is made visible.
> - Development is **spec-driven (Speckit)** and governed by a **two-layer constitution** — every decision is an artifact you can read.
> - This series follows the build week by week, from the commit history up.

---

## Section-by-section outline

### Hook + premise (120-180 words)
- Open with the tension: Elsa 3 (`elsa-core`) is a successful, widely-used .NET
  workflow engine. So why rebuild the foundation?
- Answer-first: because success exposed structural limits that couldn't be
  patched away — only re-founded.
- Frame the series promise: "We're building Elsa 4 in the open. This post is the
  map; every week after this is a step on the road."
- **Source:** `README.md` ("transitional Elsa 4 foundation workspace"),
  constitution §E2 ("Foundation repo created 2026-05-08").

### H2: What is Elsa 4 (and what "Foundation" means)? (250-300 words)
- Answer-first: Elsa 4 is the next major version; `elsa-foundation` is the
  transitional workspace where its domain core, default implementations, and
  architecture are being forged.
- The philosophy quote — use it verbatim, it's the thesis of the whole project:
  > "Elsa Foundation should be a thin protocol, not a fat one." (`README.md`)
- Define the job of the foundation: the narrow shared surface (domain language,
  core contracts, extension points, invariants, quality gates) — *not* a
  platform every feature inherits by default.
- Note the two repos readers will see in this series: `elsa-foundation`
  (engine/domain) and `elsa-foundation-studio` (the modular React studio shell).
- **Sources:** `README.md` Philosophy section; studio `README.md`.

### H2: The elsa-core baseline — seven problems that motivated a rebuild (450-550 words)
- This is the heart of the "why." Answer-first: elsa-core exhibited seven
  structural anti-patterns *at once* — and they compound.
- Walk the seven (from `docs/reference/elsa-worked-examples.md`, the
  "elsa-core baseline case study" — quote it; it's the project's own honest audit):
  1. **God packages** — `Elsa.Workflows.Core` absorbed runtime + design +
     persistence + serialization.
  2. **Framework leakage into domain code** — ASP.NET Core, expression engines,
     HTTP abstractions surfacing in transport-agnostic packages.
  3. **Forced heavy dependencies** — Medallion, Jint, Fluid, EF Core providers,
     broker SDKs all transitively reachable from the contract layer.
  4. **Infrastructure locked into the lowest layer** — persistence base
     contexts and lock impls baked into contracts.
  5. **Inverted dependency direction** — domain referencing infrastructure;
     consumers reaching into provider internals.
  6. **Silent DI resolution** — `Elsa.Common` as the vector bleeding
     `IronCompress`, `DistributedLock.Core`, config types into every consumer.
  7. **No naming convention** — `Elsa.Features.*`, `Elsa.Modules.*`,
     `Elsa.Core.Common` — layer-marker buckets that said nothing.
- **Crucial framing for credibility:** elsa-core is preserved as a *worked case
  study*, not trashed. These are the failure modes the new framework is
  *designed to prevent*. This honesty is the post's trust-builder (E-E-A-T).
- **Source:** `docs/reference/elsa-worked-examples.md` (verified).

### H2: The Elsa 4 answer — modular domains behind thin contracts (350-450 words)
- Answer-first: each domain exposes contracts through a `.Core` library, keeps
  implementations behind those contracts, and composes through sanctioned
  patterns instead of direct coupling.
- Show the domain tree concretely (from constitution §E2.1) — a table of the
  real root domains: `Elsa.Workflows.Design`, `Elsa.Workflows.Runtime`,
  `Elsa.Serialization`, `Elsa.Expressions`, `Elsa.Persistence`, `Elsa.Locking`,
  `Elsa.Modularity`, `Elsa.Http`, etc.
- The flagship structural decision: the **Workflows.Design ↔ Workflows.Runtime
  bounded-context split** (§E2.2). Runtime must *not* depend on Design. Why it's
  load-bearing: it enables Design-only, Runtime-only, and combined deployment
  shapes (§E2.2.3).
- The cleanup made concrete: `Elsa.Common` → **`Elsa.Primitives`** (§E2.3) —
  zero external NuGet dependencies, only domainless building blocks
  (`Result<T>`, `Page<T>`, guards). This is the literal antidote to problem #6.
- One worked example to make it tangible: `Elsa.Locking.Core` defines
  `IDistributedLockProvider` with zero external deps; `Elsa.Locking.FileSystem`
  hides Medallion entirely (the adapter pattern). Replacing locks = shipping a
  new module, not touching the core.
- **Sources:** constitution §E2.1, §E2.2, §E2.3; `docs/architecture-tour.md`;
  `docs/reference/elsa-worked-examples.md` (Elsa.Locking adapter example).

### H2: How the engine promises to run — two runtime invariants (250-300 words)
- Answer-first: two coupled contracts make the runtime predictable —
  **executable-always-runs** and **artifact-only runtime** (§E2.6).
- Executable-always-runs: if an artifact is published as runnable, the runtime
  *must* load and execute it. No missing-type / registry-drift / version issue
  may break that. *Whether* it's allowed to run (tenant, env, role) is a domain
  gate; *ability* to run is a system contract.
- Artifact-only: the Runtime depends on only the runnable artifact — nothing
  else. (Note honestly: the Design→Runtime seam is *deliberately deferred* —
  this is a great recurring thread for future posts.)
- **Source:** constitution §E2.6.1, §E2.6.2.

### H2: Building it in the open — spec-driven, constitution-governed (300-350 words)
- Answer-first: Elsa 4 isn't just coded, it's *specified and governed*. Every
  significant decision lands as a readable artifact.
- **Speckit specs:** 90+ numbered spec slices under `specs/` (e.g.
  `081-typed-argument-model`, `073-flowchart-scoped-execution`) — each with
  spec / plan / tasks / contracts. Development is the spec flow.
- **ADRs:** decisions captured in `docs/adr/` (28+ already) — e.g. the Extension
  Builder series, the runtime checkpoint-commit decision, scoped-variable rules.
- **Two-layer constitution:** a framework-neutral layer
  (`constitution-framework.md`) + an Elsa-specific layer (`constitution.md`),
  treated as *quality gates*, with named architects ratifying.
- **Program goals:** a roadmap of mid-term buckets (`docs/program-goals/`) —
  Runtime Execution Seam, Groundwork Persistence Readiness, etc.
- The payoff for readers: *this is why this series can exist.* The decision
  trail is public and legible — we can narrate the build because the build
  documents itself.
- **Sources:** `docs/architecture-tour.md`, `specs/` listing, `docs/adr/`
  listing, `.specify/memory/`, `docs/program-goals/README.md`.

### H2: What this series will cover (150-200 words)
- Set expectations: a weekly post mining the real commit history of both repos.
- What each week looks like: the headline decision, supporting threads, "what it
  unlocks next," and a by-the-numbers recap.
- Tease concrete upcoming threads readers can anticipate:
  - The Runtime execution seam (the deferred big one).
  - The Extension Builder initiative (20 ADRs in one week — week 7).
  - Groundwork: provider-neutral persistence.
  - Studio: a CShells modular monolith front-end.
- Invitation to follow along from commit #1.

### Conclusion (120-150 words)
- Restate the thesis: Elsa 4 is a *re-founding*, driven by honest lessons from
  elsa-core, organized around a thin protocol and made legible by spec-driven
  development.
- The journey hook: "We start at the beginning — commit one, 8 May 2026 — and
  walk forward together."
- Single CTA: follow the series / star the repos / read the constitution.

---

## FAQ section (3-5, for schema + AI citation)

1. **Is Elsa 4 released?** No — it's in active development in the open
   (`elsa-foundation`, started 2026-05-08). This series follows the build.
2. **Will Elsa 3 workflows still work?** Backward compatibility is **import-only**
   by design (constitution §E2.7) — narrate this carefully; verify current state.
3. **What does "thin foundation" actually mean?** A narrow shared contract
   surface; capabilities (persistence, HTTP, JS, scheduling) are opt-in modules.
4. **Why two repos?** `elsa-foundation` = engine/domain; `elsa-foundation-studio`
   = the modular studio front-end (CShells modular monolith).
5. **What's Speckit?** The spec-driven workflow under `.specify/` that turns
   each unit of work into spec → plan → tasks → implementation.

---

## Internal links / link architecture

- Link TO (when published): the constitution, the architecture tour, the
  glossary, the program-goals index, the elsa-core repo (for contrast).
- Link FROM (future posts): every weekly post links back here as the series hub.
- This post is the **pillar**; weekly DevJournal posts are the **cluster**.

## Visual suggestions

- **Diagram 1:** elsa-core "god package" tangle vs Elsa 4 modular `.Core` + impl
  separation (before/after). High-value hero image.
- **Diagram 2:** the Design ↔ Runtime bounded-context split with the
  one-directional rule (Runtime ✗→ Design).
- **Callout/table:** the seven elsa-core anti-patterns → the Elsa 4 rule that
  answers each.
- **Snippet:** `Elsa.Locking.Core` interface + `Elsa.Locking.FileSystem` adapter
  (the "Medallion stays hidden" example).

## Fact-check / verification checklist before publishing

- [ ] Re-read `docs/reference/elsa-worked-examples.md` — quote the seven points exactly.
- [ ] Confirm the §E2 domain table still matches current `src/` layout.
- [ ] Confirm §E2.7 backward-compat wording is still "import-only" at publish time.
- [ ] Verify the 2026-05-08 start date and the foundation repo name.
- [ ] Confirm studio framing (CShells modular monolith) from studio `README.md`.
- [ ] Get an architect (Sipke/Joey/Frans) to sanity-check the "why" framing —
      the elsa-core critique should read as honest retrospective, not blame.
