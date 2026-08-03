---
title: "How Elsa Converts Outputs at the Binding Boundary"
slug: "elsa-output-converters-binding-boundary"
description: "Elsa output converters transform one activity result for one binding while preserving the native output. Learn the design backed by 47 targeted Core tests."
publishedAt: "2026-08-03"
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "activity-outputs"
  - "workflow-authoring"
  - "extensibility"
featuredImage: "../assets/2026-08-03-elsa-output-converters-binding-boundary/featured.png"
featuredImageAlt: "A native workflow output branches through an optional converter before reaching a bound destination."
seoTitle: "How Elsa Converts Outputs at the Binding Boundary"
seoDescription: "Elsa output converters transform one activity result for one binding while preserving the native output. Learn the design backed by 47 targeted Core tests."
redirectFrom: []
---

# How Elsa Converts Outputs at the Binding Boundary

An activity can return exactly the right .NET value and still give a workflow author the wrong shape for the next step. A SQL activity might expose a `DataSet`; a script or variable might be easier to work with if that result were a collection of dictionaries. Until now, the usual fixes were wrapper activities, extra transformation steps, or repeated expression code.

[Elsa Core PR #7902](https://github.com/elsa-workflows/elsa-core/pull/7902) adds a more focused option: an output converter attached to one binding. The activity keeps its native output, while the selected variable or workflow output receives the converted value. [Elsa Studio PR #922](https://github.com/elsa-workflows/elsa-studio/pull/922) adds server-driven converter selection and settings editing to the workflow designer.

> **Key Takeaways**
> - Conversion belongs to one output binding; it does not replace the activity's native result.
> - Converters are explicit, synchronous, deterministic, side-effect-free services registered through dependency injection.
> - Elsa validates converter identity, types, settings, and results before changing the destination.

> **Availability:** The Core and initial Studio implementations merged to `main` on July 31, 2026. Studio refinements also landed on `release/3.8.0` on August 2. The released `3.8.0-preview1` predates this work, and Elsa 3.8 stable has not shipped. Use a post-merge preview build that includes Core #7902 and Studio #922, and keep Core, API client, and Studio package versions aligned. For broader release context, see [Elsa 3.8 Preview 1](/blog/elsa-3-8-preview-1).

## What problem do output converters solve?

Output converters solve a destination-specific representation problem without changing the activity contract. [Issue #7770](https://github.com/elsa-workflows/elsa-core/issues/7770) lists common examples: `DataSet` results, XML or CSV text, and binary content. Those formats can be valid native outputs while remaining awkward for expressions, variables, scripts, or downstream activities.

The old workarounds all widen the workflow for what is really a binding concern. Changing the source activity makes one consumer's preference part of the activity's public contract. A wrapper activity duplicates behavior. A separate transformation activity adds another node and another execution step.

An output converter keeps those responsibilities apart:

```text
Activity native output ───────────────> output register and diagnostics
          |
          └── optional converter ─────> bound variable or workflow output
```

<!-- [UNIQUE INSIGHT] -->

The important design choice is that Elsa does not create a global “converted output.” Conversion belongs to the edge between a source output and one selected destination. The native value remains available in the activity-output register, while that destination receives the converted value.

## Where does conversion happen?

Conversion happens during output assignment, after the activity has produced its native value and before Elsa writes the selected destination. The [output-converter documentation](https://github.com/elsa-workflows/elsa-core/blob/5b0c2d7359ecc5bb8e77603dab43e90a6608b195/doc/wiki/output-converters.md) describes this as a binding-boundary operation. Bindings without a converter stay on the existing assignment path.

That placement gives the feature a narrow contract. The converter receives only four things: the non-null native value, the declared source type, the destination type, and immutable JSON settings. It does not receive an activity execution context or a general-purpose service provider.

The [runtime invoker](https://github.com/elsa-workflows/elsa-core/blob/5b0c2d7359ecc5bb8e77603dab43e90a6608b195/src/modules/Elsa.Workflows.Core/Services/OutputConverterInvoker.cs) resolves the converter from the active workflow scope, validates it, calls it synchronously, validates the result, and only then returns the value for assignment. The Core PR reports 47 targeted converter and serialization tests, plus management, API, client, runtime, and performance checks.

## How do you implement and register a converter?

Implement `IOutputConverter`, then register it with a descriptor that has a stable ID, source type, result type, display metadata, and optional settings schema. The ID is persisted in workflow definitions, so treat it as a versioned public contract.

This example follows the Core implementation guide. It assumes `services` is your application's `IServiceCollection`:

```csharp
using System.Globalization;
using System.Text.Json;
using Elsa.Extensions;
using Elsa.Workflows;
using Elsa.Workflows.Models;

public sealed class NumberToTextConverter : IOutputConverter
{
    public object Convert(OutputConversionContext context)
    {
        var format = context.Settings?.TryGetProperty("format", out var value) == true
            ? value.GetString()
            : null;

        return ((decimal)context.Value)
            .ToString(format, CultureInfo.InvariantCulture);
    }
}

using var schemaDocument = JsonDocument.Parse(
    """{"type":"object","properties":{"format":{"type":"string"}}}""");

services.AddOutputConverter<NumberToTextConverter>(
    new OutputConverterDescriptor(
        "sample.number-to-text.v1",
        typeof(decimal),
        typeof(string),
        "Number to text",
        "Formats a decimal using an invariant format.",
        schemaDocument.RootElement));
```

The default lifetime is scoped. Elsa caches registrations and descriptors, not converter instances. The [registration extension](https://github.com/elsa-workflows/elsa-core/blob/5b0c2d7359ecc5bb8e77603dab43e90a6608b195/src/modules/Elsa.Workflows.Core/Extensions/OutputConverterServiceCollectionExtensions.cs) also rejects duplicate IDs, including IDs that differ only by case.

Keep environmental choices explicit. Locale, timezone, and rounding rules belong in settings rather than ambient process state. In a modular host, put the registration in the feature or shell that owns the extension; [configuring Elsa with shell features](/blog/configuring-elsa-with-shell-features) explains that boundary. If you need asynchronous work, I/O, or workflow-state mutation, use an activity instead of a converter.

## How does a workflow select the converter?

Converter configuration lives on the output binding. In code, an `Output<T>` can name the converter ID and provide per-binding JSON settings:

```csharp
activity.Result = new Output<decimal>(targetVariable)
{
    Converter = new OutputConverterConfiguration(
        "sample.number-to-text.v1",
        JsonDocument.Parse("""{"format":"0.00"}""").RootElement)
};
```

The serialized workflow stores that ID and settings beside the memory reference. Workflows without a converter omit the `converter` object, which preserves existing definitions and behavior.

In Studio, authors first select a variable or workflow-output destination. Studio then queries the server's authorized discovery endpoint for descriptors compatible with the source and destination types. [The Outputs tab implementation](https://github.com/elsa-workflows/elsa-studio/blob/c7a2b79c36ed06d3ee36c45022049401dbb989ef/src/modules/Elsa.Studio.Workflows/Components/WorkflowDefinitionEditor/Components/ActivityProperties/Tabs/Outputs/Components/OutputsTab.razor) presents those descriptors and renders schema-driven settings fields when possible.

This server-owned discovery matters for modular Elsa hosts. Studio does not guess which converters are installed. A converter appears because the connected server registered it and declared compatible types. When discovery succeeds, unknown persisted IDs remain visible as unavailable instead of being silently deleted. If discovery fails or the server is older, Studio hides the converter controls but preserves the stored configuration. It follows the same capability-aware principle behind [Elsa Studio's split dashboard](/blog/the-elsa-studio-dashboard-is-split-on-purpose).

## What happens when conversion fails?

Elsa validates the binding at definition time and checks it again at runtime. It verifies that the destination resolves, the converter ID exists, the source type is compatible, the result type can be assigned, and the settings pass both JSON Schema and converter-owned validation.

For a non-null value, conversion and result validation finish before Elsa writes the destination. If the converter throws or returns an incompatible result, the destination remains unchanged and the activity faults through the normal pipeline with an `OutputConversionException`.

Persisted exception state includes safe identifiers and the failure stage, but excludes the native value, raw settings, and converter exception details. This makes failures diagnosable without copying potentially sensitive payloads into workflow state.

Nulls take a deliberate shortcut. A null native value bypasses converter invocation and is assigned only when the destination permits null. A converter is therefore not a hidden null-coalescing hook.

## When should you use an activity instead?

Use an output converter for a local, deterministic representation change that exists only because a destination wants another type or shape. Use an explicit activity when the transformation is meaningful workflow work, needs I/O, can wait, has side effects, or deserves its own retries and observability.

| Requirement | Output converter | Activity |
| --- | --- | --- |
| Change one binding's representation | Yes | Usually unnecessary |
| Preserve the native activity output | Yes | Depends on workflow design |
| Perform asynchronous I/O | No | Yes |
| Mutate workflow state beyond the destination | No | Yes |
| Expose retries or branching around the transformation | No | Yes |

<!-- [UNIQUE INSIGHT] -->

A useful test is to ask whether the transformation explains the **data edge** or the **business process**. Formatting a decimal for a string variable explains the edge. Looking up an exchange rate explains the process and belongs in an activity.

## Frequently asked questions

### Does a converter replace the activity's native output?

No. The activity-output register and diagnostics retain the native value. The one variable or workflow-output destination attached to that `Output<T>` binding receives the converted value. Conversion does not overwrite the native value recorded for diagnostics and activity-output access.

### Can Studio configure any conversion automatically?

No. Studio shows converters discovered from the connected server and filtered for the selected source and destination types. An extension or host must register the converter and its descriptor first. Studio edits the persisted configuration; it does not invent conversion code or infer arbitrary type coercions.

### What happens if a converter is removed later?

A published workflow that still references its stable ID will fault when Elsa reaches that assignment. Treat converter removal as deployment drift. Keep old registrations while referenced definitions exist, and introduce a new versioned ID when behavior or settings change incompatibly.

## The practical takeaway

Output converters give Elsa a small but valuable extensibility seam. Activities can keep returning their natural domain values, while each binding chooses the representation its destination needs. The workflow stays smaller, the conversion remains explicit, and failures occur before destination state changes.

The boundary is intentionally strict: deterministic code in, converted value out. Once a transformation needs time, external systems, or workflow semantics, make it visible as an activity.

## Primary sources

- [Elsa Core issue #7770: Extensible Activity Output Converters](https://github.com/elsa-workflows/elsa-core/issues/7770), opened 2026-07-19 and accessed 2026-08-03.
- [Elsa Core PR #7902: Add extensible output converters](https://github.com/elsa-workflows/elsa-core/pull/7902), merged 2026-07-31 and accessed 2026-08-03.
- [Output converter implementation guide](https://github.com/elsa-workflows/elsa-core/blob/5b0c2d7359ecc5bb8e77603dab43e90a6608b195/doc/wiki/output-converters.md), accessed 2026-08-03.
- [`IOutputConverter` contract](https://github.com/elsa-workflows/elsa-core/blob/5b0c2d7359ecc5bb8e77603dab43e90a6608b195/src/modules/Elsa.Workflows.Core/Contracts/IOutputConverter.cs), accessed 2026-08-03.
- [Output converter runtime invoker](https://github.com/elsa-workflows/elsa-core/blob/5b0c2d7359ecc5bb8e77603dab43e90a6608b195/src/modules/Elsa.Workflows.Core/Services/OutputConverterInvoker.cs), accessed 2026-08-03.
- [Output converter discovery endpoint](https://github.com/elsa-workflows/elsa-core/blob/5b0c2d7359ecc5bb8e77603dab43e90a6608b195/src/modules/Elsa.Workflows.Api/Endpoints/OutputConverters/List/Endpoint.cs), accessed 2026-08-03.
- [Elsa Studio PR #922: Add output converter authoring support](https://github.com/elsa-workflows/elsa-studio/pull/922), merged 2026-07-31 and accessed 2026-08-03.
- [Elsa Studio PR #929: workflow-designer refinements](https://github.com/elsa-workflows/elsa-studio/pull/929), merged 2026-08-02 and accessed 2026-08-03.
