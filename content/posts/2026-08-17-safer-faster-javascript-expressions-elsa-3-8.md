---
title: "Safer, Faster JavaScript Expressions in Elsa 3.8"
slug: "safer-faster-javascript-expressions-elsa-3-8"
description: "Elsa 3.8 adds a 30-second JavaScript timeout, non-blocking promises, leaner evaluator setup, and an enum-constant upgrade note for existing workflows."
publishedAt: "2026-08-17"
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "javascript"
  - "expressions"
  - "security"
featuredImage: "../assets/2026-08-17-safer-faster-javascript-expressions-elsa-3-8/featured.png"
featuredImageAlt: "A soft blue JavaScript runtime engine surrounded by timeout, memory, statement, and recursion controls."
seoTitle: "Safer, Faster JavaScript Expressions in Elsa 3.8"
seoDescription: "Elsa 3.8 adds a 30-second JavaScript timeout, non-blocking promises, leaner evaluator setup, and an enum-constant upgrade note for existing workflows."
redirectFrom: []
related:
  - "secret-references-in-elsa-3-8"
  - "elsa-3-8-preview-1"
  - "suspended-workflows-and-elsa-upgrades"
  - "building-elsa-4-week-2"
---

# Safer, Faster JavaScript Expressions in Elsa 3.8

JavaScript expressions are convenient because they sit close to the workflow. A condition can read a variable, an input can await a secret, and a small transformation can stay beside the activity that uses it.

**Jint** is the .NET JavaScript interpreter behind Elsa 3 expressions. Until now, Elsa imposed no default execution bound on it. A script such as `while (true) {}` could occupy its calling thread indefinitely. Promise-returning expressions blocked a thread while Jint drained its event loop. Every evaluation also paid to install globals the expression might never read.

Five merged pull requests change that for the Elsa 3.8 line: [#7891](https://github.com/elsa-workflows/elsa-core/pull/7891), [#7892](https://github.com/elsa-workflows/elsa-core/pull/7892), [#7893](https://github.com/elsa-workflows/elsa-core/pull/7893), [#7894](https://github.com/elsa-workflows/elsa-core/pull/7894), and [#7895](https://github.com/elsa-workflows/elsa-core/pull/7895).

> **Key Takeaways**
> - JavaScript evaluation now has a 30-second default timeout, plus configurable statement, memory, and recursion limits.
> - Promise-returning expressions are awaited without holding a thread pool thread, and workflow cancellation reaches Jint's execution loop.
> - Elsa builds less evaluator state for ordinary expressions, but enum constants now surface as names instead of numbers.

> **Availability:** These changes merged into `main` on August 16, 2026, after `3.8.0-preview1`. They are not in the latest stable release, 3.7.1, or in Preview 1. Build from a source revision containing Core PRs #7891-#7895, or wait for a later Elsa 3.8 package. Keep Core modules on aligned versions when you test the change. [Elsa 3.8 Preview 1](/blog/elsa-3-8-preview-1) provides the wider release context.

## What now stops a runaway expression?

Elsa now configures Jint with one default wall-clock limit and three optional resource limits. The ambient cancellation token is registered as an engine constraint too, so cancellation can interrupt synchronous JavaScript execution rather than only the asynchronous work around it.

| Limit | Elsa 3.8 default | What it bounds |
| --- | --- | --- |
| `ExecutionTimeout` | 30 seconds | Wall-clock time for one expression |
| `MaxStatements` | No limit | Executed JavaScript statements |
| `MemoryLimit` | No limit | Memory allocated by the Jint engine |
| `MaxRecursionDepth` | No limit | JavaScript recursion depth |

The [new `JintOptions` properties](https://github.com/elsa-workflows/elsa-core/blob/7328a0f14d4f6e21cb422f649c5d9eb0471d159a/src/modules/Elsa.Expressions.JavaScript/Options/JintOptions.cs) are applied while each engine is configured. [Integration tests](https://github.com/elsa-workflows/elsa-core/blob/7328a0f14d4f6e21cb422f649c5d9eb0471d159a/test/integration/Elsa.JavaScript.IntegrationTests/ExecutionConstraintTests.cs) exercise an infinite loop, cancellation, statement overflow, growing string allocation, and unbounded recursion. A normal expression is also tested against the defaults.

You can tighten the limits for a host that accepts user-authored workflows:

```csharp
services.AddElsa(elsa =>
{
    elsa.UseJavaScript(jint =>
    {
        jint.ExecutionTimeout = TimeSpan.FromSeconds(5);
        jint.MaxStatements = 10_000;
        jint.MemoryLimit = 4_000_000;
        jint.MaxRecursionDepth = 64;
    });
});
```

Those numbers are examples, not universal recommendations. A host that permits heavier transformations needs different limits from one that expects only short conditions. Start by measuring representative expressions, then leave enough headroom for legitimate work without making the bounds meaningless.

<!-- [UNIQUE INSIGHT] -->

The important change is not that JavaScript has become a sandbox. It has not. CLR and configuration access still need their own deliberate host settings. Execution limits solve a narrower problem: they give the interpreter a bounded failure mode when an expression loops, allocates, recurses, or outlives its workflow cancellation.

## Why do asynchronous expressions use fewer threads?

Elsa previously called Jint synchronously, then used `UnwrapIfPromise()` to drain the returned promise. That happened inside an asynchronous evaluator, so an expression awaiting a .NET `Task` still held a thread pool thread until the task completed.

[Core PR #7894](https://github.com/elsa-workflows/elsa-core/pull/7894) upgrades Jint from 4.4.2 to 4.15.3 and switches the evaluator to `Engine.EvaluateAsync`. A promise can now suspend and resume without blocking the calling thread. The evaluator also observes cancellation during that await.

This matters for expressions that cross an I/O boundary. `getSecret()` is the clearest built-in example: [secret references in Elsa 3.8](/blog/secret-references-in-elsa-3-8) return promise-compatible values because resolving a secret may be asynchronous. The expression syntax does not change, but the runtime no longer needs to hold a thread while it waits.

The version choice is part of the correctness story. Jint 4.15.2 fixed async suspension behavior used by the new path, including state preservation around `await` and asynchronous iteration. The merged change therefore targets 4.15.3 instead of stopping at the first release that exposed `EvaluateAsync`.

One Jint default was deliberately not adopted. Newer Jint versions can expose a CLR array as a live view. Elsa keeps the previous copy behavior, so sorting an array inside JavaScript does not reorder the workflow's original CLR array as a side effect. Hosts can still opt into `ArrayConversionMode.LiveView` through `ConfigureEngineOptions` when that behavior is intentional.

## Where did the evaluator setup work go?

Elsa creates a fresh Jint engine for each expression evaluation. Before the change, that meant eagerly registering common CLR types, workflow accessors, activity-output accessors, and common helper functions every time, even when an expression used almost none of them.

The merged work removes setup from several paths:

- common types and functions are installed as lazy globals and materialized only on first read;
- variable, input, and activity-output accessors are registered only when the prepared script references their names;
- unusable type globals such as array and constructed-generic names are skipped;
- an existing host global wins instead of being silently replaced by a built-in type registration;
- repeated script-cache hits use the expression as a typed cache key instead of hashing it with SHA-256 each time;
- stateless object converters are reused, and variable write-back returns early when there is nothing to copy.

Dynamic JavaScript needs a conservative escape hatch. If a script references `globalThis`, direct or indirect `eval`, or the `Function` constructor, Elsa disables the referenced-global filter and registers the full accessor set. Expressions that use ordinary identifiers still get the lean path. The always-available functions such as `getVariable(name)` and `getOutputFrom(activityId, outputName)` remain available for dynamically chosen names.

<!-- [ORIGINAL DATA] -->

PR #7895 includes an end-to-end benchmark against a real `WorkflowExecutionContext` containing 40 output-producing activities and 10 object-valued variables. For an expression naming one variable, the reported mean fell from 102.9 microseconds to 29.93 microseconds, while allocation fell from 174.46 KB to 53.52 KB.

| Benchmark case | Mean before | Mean after | Allocation before | Allocation after |
| --- | ---: | ---: | ---: | ---: |
| One named variable | 102.9 µs | 29.93 µs | 174.46 KB | 53.52 KB |
| Type + variable + activity output accessors | 148.1 µs | 99.11 µs | 227.89 KB | 152.05 KB |

Read those figures with the PR's caveat. They measure the combined Jint upgrade and evaluator changes at an intermediate 4.15.1 revision. The benchmark was not rerun after the final 4.15.3 pin and lazy common-function work. They demonstrate the direction and the measured scenario, not a blanket performance promise for every workflow.

## Which enum expressions need review?

The Jint integration now exposes .NET enum values and registered enum constants consistently as member names. Before the change, a variable holding `LogPersistenceMode.Include` reached JavaScript as `"Include"`, while reading `LogPersistenceMode.Include` directly produced its underlying number. Comparing them with `===` was therefore false.

In Elsa 3.8, both sides are strings. This fixes the inconsistent comparison, but it changes raw numeric uses of registered enum constants:

```javascript
// Portable before and after the change.
mode === 'Include'

// Review: the constant now evaluates to "Include", not its number.
LogPersistenceMode.Include + 1
```

Typed conversions still accept the member name or number when a value moves back into a .NET enum property, activity input, or typed variable. The upgrade risk sits in JavaScript that treats a constant as a number, and in persisted data created by that pattern.

Suppose an in-flight workflow stored the old numeric value in an untyped variable. After the upgrade, comparing that stored number with `LogPersistenceMode.Include` compares a number with a string. The [3.8 changelog](https://github.com/elsa-workflows/elsa-core/blob/7328a0f14d4f6e21cb422f649c5d9eb0471d159a/doc/changelogs/3.8.0.md) calls this out because it can affect resumed instances, not only new ones.

Before upgrading, search definitions and code for registered enum constants used in arithmetic, numeric comparisons, or persisted untyped variables. Prefer comparison with the member name when the expression's intent is symbolic. For broader upgrade planning around durable state, see [Suspended Workflows and Elsa Upgrades](/blog/suspended-workflows-and-elsa-upgrades).

## What should an Elsa host do before adopting the change?

<!-- [PERSONAL EXPERIENCE] -->

For an Elsa host, our preference is to treat the evaluator work as separate review tasks rather than one package bump.

1. **Choose limits for your trust boundary.** Keep the 30-second timeout or lower it. Add statement, memory, and recursion limits when users can author JavaScript. Test real expressions before setting production values.
2. **Exercise asynchronous expressions.** Run workflows that call `getSecret()` or custom promise-returning functions. Confirm cancellation, successful completion, and failure handling in your host.
3. **Audit enum constants.** Look for numeric use and persisted values that may resume after the upgrade. Migrate expressions toward member-name comparisons where practical.
4. **Keep arrays intentional.** Elsa preserves copy semantics by default. If your host opts into live views, add tests proving that JavaScript mutation of CLR arrays is acceptable.
5. **Benchmark your own workflow shapes.** The published benchmark uses 40 output-producing activities and 10 object variables. Smaller or more accessor-heavy workflows will see a different result.

Do not disable the timeout merely to preserve an expression that currently runs too long. A large transformation may belong in a custom activity, where it can use typed inputs, normal .NET diagnostics, targeted retries, and its own cancellation policy.

## Frequently asked questions

### Does the default timeout make untrusted JavaScript safe?

No. It prevents one class of runaway execution by bounding wall-clock time. Optional statement, memory, and recursion limits add more controls. Hosts must still decide whether user-authored workflows may access CLR types, configuration, custom functions, network-capable services, or sensitive workflow data.

### Will existing JavaScript expressions become slower because of the limits?

The merged integration tests show normal expressions completing with the default timeout enabled. The same change set removes eager evaluator setup, and PR #7895 measured lower latency and allocation in both benchmark cases. Your result still depends on expression content and workflow shape, so measure representative workloads.

### Do I need to rewrite `getSecret()` expressions?

No. Promise-compatible secret expressions keep the same JavaScript shape. The runtime change is underneath them: Jint now awaits the promise without blocking a thread, and the cancellation token is observed by the engine and the asynchronous evaluation path.

### Is the enum change binary-breaking for custom handlers?

The enum behavior is a JavaScript semantic change. Separately, `EvaluatingJavaScript` gained a trailing optional `ReferencedGlobals` parameter. Source consumers remain compatible, but an external assembly that constructs or positionally deconstructs that record must be recompiled against the new package.

## The practical takeaway

The Jint upgrade is useful because it improves three different boundaries at once. Runaway scripts stop. Promise-based I/O no longer occupies a waiting thread. Ordinary expressions pay for less unused engine setup.

The one change that deserves migration work is also the easiest to state: registered enum constants are names now. Audit numeric uses and persisted untyped values before moving running systems onto a build that contains these PRs.

Once a later Elsa 3.8 package includes the merged work, start with a staging host, keep the default timeout, add limits that match your trust model, and resume a representative set of suspended workflows. That gives the new evaluator path evidence in your own environment before it carries production work.

## Primary sources

- [Core PR #7891: Bound JavaScript expression execution](https://github.com/elsa-workflows/elsa-core/pull/7891), Elsa Workflows, merged 2026-08-16 and retrieved 2026-08-17.
- [Core PR #7892: Trim per-evaluation work in the JavaScript evaluator](https://github.com/elsa-workflows/elsa-core/pull/7892), Elsa Workflows, merged 2026-08-16 and retrieved 2026-08-17.
- [Core PR #7893: Stop registering colliding and unreachable type globals](https://github.com/elsa-workflows/elsa-core/pull/7893), Elsa Workflows, merged 2026-08-16 and retrieved 2026-08-17.
- [Core PR #7894: Update Jint to 4.15.3 and stop blocking on promises](https://github.com/elsa-workflows/elsa-core/pull/7894), Elsa Workflows, merged 2026-08-16 and retrieved 2026-08-17.
- [Core PR #7895: Adopt the Jint 4.15 host-integration surface](https://github.com/elsa-workflows/elsa-core/pull/7895), Elsa Workflows, merged 2026-08-16 and retrieved 2026-08-17.
- [`JintOptions` execution constraints](https://github.com/elsa-workflows/elsa-core/blob/7328a0f14d4f6e21cb422f649c5d9eb0471d159a/src/modules/Elsa.Expressions.JavaScript/Options/JintOptions.cs), Elsa Core, retrieved 2026-08-17.
- [Elsa 3.8 JavaScript upgrade notes](https://github.com/elsa-workflows/elsa-core/blob/7328a0f14d4f6e21cb422f649c5d9eb0471d159a/doc/changelogs/3.8.0.md), Elsa Core, retrieved 2026-08-17.
- [Elsa Core 3.7.1 release](https://github.com/elsa-workflows/elsa-core/releases/tag/3.7.1), latest stable release when retrieved on 2026-08-17.
