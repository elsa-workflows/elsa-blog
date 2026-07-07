# Outline: Building Elsa 4 Week 2

## Title Suggestions
1. Building Elsa 4 · Week 2: A Quiet Week of Seam Discipline
2. Building Elsa 4 · Week 2: Cross-Domain Hooks Without Coupling
3. Building Elsa 4 · Week 2: What Did a Quiet Week Prove?

## Target Parameters
- **Primary keyword**: Building Elsa 4
- **Search intent**: Informational / series continuity
- **Target word count**: 900-1,300 words
- **H2 sections**: DevJournal-required structure
- **Target reading level**: Technical, concise, source-grounded

---

## Outline

### H2: Where we are on the road (~120 words)
- **Answer-first opener**: Week 2 was quiet in decision artifacts but loud in seam discipline.
- **Key points**:
  - Week 1 / “Why Elsa 4?” established constitution-first principles.
  - Elsa Foundation is meant to be a thin protocol, not a fat core.
  - This week tested that principle in cross-domain hooks and scripting.

### Key Takeaways box (~80 words)
- DomainEvent handlers through Mediator created cross-domain hooks without direct references.
- Jint was held behind an adapter-style execution context.
- HTTP, JavaScript, and FastEndpoints refactoring continued the split between model ownership, consumption shape, and API adapter.

### H2: The headline: cross-domain hooks without cross-domain references (~400 words)
- **Answer-first opener**: The week’s important decision was DomainEvents plus Mediator for hooks.
- **Key points**:
  - Cross-domain extension points are useful but dangerous.
  - Mediator handlers let a domain publish a named event without depending on every subscriber.
  - This rules out direct feature-to-feature implementation references.
  - Cite `a56190fb` and `a9d0697f`.

### H2: Supporting thread: Jint stayed behind an adapter (~300 words)
- **Answer-first opener**: The Jint work matters because consumers should not inherit a script engine by touching a JavaScript contract.
- **Key points**:
  - `IJavaScriptExecutionContext` exposes get/set/register/evaluate/execute behavior.
  - Jint implements the behavior behind the boundary.
  - Tie to Elsa.Locking adapter example and forced-heavy-dependency anti-pattern.
  - Cite `a9d0697f` and `docs/reference/elsa-worked-examples.md`.

### H2: Supporting thread: HTTP, JavaScript, and FastEndpoints were separated by shape (~260 words)
- **Answer-first opener**: The HTTP/JavaScript/FastEndpoints refactor was boundary work, not feature glitter.
- **Key points**:
  - HTTP owns HTTP models.
  - JavaScript consumes function declarations and runtime bindings.
  - FastEndpoints is API composition, not domain surface.
  - Cite `a33351cb` and worked examples.

### H2: What this unlocks next (~160 words)
- **Answer-first opener**: These seams make later feature work less expensive.
- **Key points**:
  - More hooks can land without hard references.
  - Another script engine can replace Jint through an adapter module.
  - Future refactors can be reviewed against dependency direction.

### H2: This week by the numbers (~120 words)
- 4 non-merge commits.
- 0 merged PRs.
- 831 files changed, +15,402 / -4,320.
- Sole contributor in prose: Joey Barten (`j03y-nxxbz`).
- Best source links: four commits, README, worked examples, framework constitution.

### H2: Follow along (~80 words)
- Foundation repo.
- Studio repo.
- Constitution.
- Glossary.

---

## Content Gaps to Exploit
1. Avoid pretending a quiet week had a major public decision artifact.
2. Make dependency direction the story.
3. Use exact commit sources instead of invented PRs, specs, or ADRs.
