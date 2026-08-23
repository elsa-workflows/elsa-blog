---
title: "Why Elsa Payloads Change Shape After Persistence"
slug: "why-elsa-payloads-change-shape-after-persistence"
description: "Custom Elsa payloads can return as camel-cased property bags after persistence. Learn when to register a serialization type alias and when to use a dictionary."
publishedAt: "2026-08-23"
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "serialization"
  - "persistence"
  - "events"
  - "testing"
featuredImage: "../assets/2026-08-23-why-elsa-payloads-change-shape-after-persistence/featured.png"
featuredImageAlt: "Soft 3D technical illustration of blue payload objects crossing a persistence gateway, with a type tag preserving one payload's shape while another becomes a property bag"
seoTitle: "Why Elsa Payloads Change Shape After Persistence"
seoDescription: "Custom Elsa payloads can return as camel-cased property bags after persistence. Register a serialization type alias to preserve the original .NET type."
redirectFrom: []
---

# Why Elsa Payloads Change Shape After Persistence

A custom Elsa payload can look correct while it is still a live CLR object, then come back from persisted workflow state as an `ExpandoObject` with camel-cased keys. A property named `Status`, for example, may reappear as `status`.

That is not an event-delivery bug or merely a JSON casing setting. It means Elsa stored the value without a `_type` discriminator, so it could not safely reconstruct the original .NET type. The durable fix is to register a workflow serialization alias for typed payloads. If you actually want a property bag, use a dictionary deliberately.

> **Key Takeaways**
> - An unregistered custom POCO or anonymous object can return from persisted workflow state as a camel-cased property bag.
> - Register the type with `SerializationTypeOptions` when consumers need the original CLR type after persistence.
> - Test the store-loaded path. A test that only observes the live in-memory object can miss the representation change.

> **Availability**
> The fallback behavior described here predates the current change. [Elsa Core PR #7969](https://github.com/elsa-workflows/elsa-core/pull/7969), merged to `main`, adds a once-per-type warning and clearer `PublishEvent` documentation. That warning is not in Elsa 3.8 RC2, and there is no announced 3.9 package date at the time of writing.

<!-- insight: The surprising casing change is evidence of lost type identity, not the root problem. -->

## What changes when Elsa persists a custom payload?

Elsa's workflow state serializer handles polymorphic values. When it recognizes a registered type, it writes a `_type` discriminator and can restore that CLR type later. When it does not recognize a POCO or anonymous type, it serializes the public data without that discriminator. On the way back, Elsa reads the JSON object as a property bag.

The result depends on the contract you chose:

| Value written to workflow state | Value after persistence | Property names |
| --- | --- | --- |
| Anonymous object | `ExpandoObject` | Camel-cased |
| Unregistered POCO | `ExpandoObject` | Camel-cased |
| Registered POCO | Original CLR type | Restored through the POCO contract |
| `Dictionary<string, object>` | Intentional property bag | Preserved verbatim |

The four cases are covered by the [tests added with PR #7969](https://github.com/elsa-workflows/elsa-core/blob/1b38c3511d4d3b8fcf64c50808a406387359724c/test/integration/Elsa.Workflows.IntegrationTests/Core/UnaliasedPayloadWarningTests.cs). The important distinction is not just `Status` versus `status`. An unregistered `ShipmentPayload` is no longer a `ShipmentPayload` after the round trip.

This can be especially confusing around events. [`PublishEvent.Payload`](https://github.com/elsa-workflows/elsa-core/blob/1b38c3511d4d3b8fcf64c50808a406387359724c/src/modules/Elsa.Workflows.Runtime/Activities/PublishEvent.cs#L34-L47) becomes part of the receiving workflow's persisted state. Depending on whether code observes the live instance or reloads the instance from storage, it may encounter either the original CLR object or the property-bag representation.

## Why does Elsa require a serialization type alias?

Elsa treats workflow JSON type resolution as an allow-list. It resolves types that the host registered instead of loading any CLR type name found in stored JSON. This design matters because workflow state is durable input to the runtime, and arbitrary type resolution would make that boundary less safe.

The security hardening in [issue #7472](https://github.com/elsa-workflows/elsa-core/issues/7472) and [PR #7499](https://github.com/elsa-workflows/elsa-core/pull/7499) removed a fallback that could resolve arbitrary CLR type names. A serialization alias now serves two jobs: it is a compact persisted identifier, and it explicitly tells Elsa which application type is allowed to cross the workflow-state boundary.

That is why changing the global JSON naming policy is not the right fix. Case sensitivity might affect how a consumer reads a property, but it does not restore the missing CLR type identity.

For the broader upgrade implication, see [Suspended Workflows Are Runtime State, Not Just Definitions](/blog/suspended-workflows-and-elsa-upgrades). Once workflow state is durable, its aliases and shapes become part of your application's compatibility surface.

## How do you register a custom payload safely?

Register the payload during application startup through `SerializationTypeOptions`. This is separate from expression aliases and activity input configuration.

```csharp
using Elsa.Common.Serialization;
using Elsa.Extensions;
using Microsoft.Extensions.DependencyInjection;

services.Configure<SerializationTypeOptions>(options =>
    options.AddTypeAlias<ShipmentPayload>("sample.shipment.v1"));
```

With a simple application contract:

```csharp
public sealed class ShipmentPayload
{
    public string Status { get; init; } = default!;
}
```

Elsa will persist the alias as the value's `_type` discriminator. When it reads the workflow state again, the registered alias resolves to `ShipmentPayload`, so consumers get the original type and its `Status` property.

You can also call `options.AddTypeAlias<ShipmentPayload>()`. That overload uses the CLR type name as the alias. An explicit value such as `sample.shipment.v1` makes the durable identifier intentional and independent of a later class rename. Whatever name you choose, keep it registered while persisted workflow instances may still refer to it.

Registration must be present when state is both written and read. Adding an alias later helps new writes, but it does not add a missing `_type` discriminator to JSON that is already stored. Existing untyped records need to be treated as property bags or migrated deliberately.

<!-- insight: A serialization alias is application data schema, not merely startup plumbing. -->

## When should you use a dictionary instead?

Not every payload needs a CLR contract. A dictionary is the better choice when the data is intentionally dynamic and consumers already work with keys and values:

```csharp
var payload = new Dictionary<string, object>
{
    ["Status"] = "Shipped",
    ["TrackingNumber"] = "ELSA-1042"
};
```

Elsa treats this as a deliberate property bag. It does not emit the unregistered-POCO warning, and the keys stay `Status` and `TrackingNumber` after persistence.

The tradeoff is explicit. A dictionary preserves a flexible key-value contract, but it does not give consumers a `ShipmentPayload` API or compile-time property checks. Choose a registered POCO for a durable typed contract. Choose a dictionary when a property bag is the contract.

Anonymous objects are convenient at the call site, but they are a poor durable contract when downstream code expects a specific .NET type after a workflow suspends and resumes.

## How should you test the persistence boundary?

Force a real serialization round trip. Do not stop at an assertion against the object you just passed to Elsa.

A useful test should verify three things for a typed payload:

1. Serialized workflow state contains the expected `_type` alias.
2. Deserialized state contains the original CLR type.
3. The restored property value is correct.

In outline, the assertion looks like this:

```csharp
var state = new WorkflowState
{
    Output =
    {
        ["Payload"] = new ShipmentPayload { Status = "Shipped" }
    }
};

var json = serializer.Serialize(state);
Assert.Contains("\"_type\":\"sample.shipment.v1\"", json);

var restored = serializer.Deserialize(json);
var payload = Assert.IsType<ShipmentPayload>(restored.Output["Payload"]);
Assert.Equal("Shipped", payload.Status);
```

The exact serializer setup belongs in your test fixture, using the same Elsa service configuration as the application. The key is the boundary: serialize, discard the live object, deserialize, then assert against the restored state.

Add a second test if a property bag is intentional. Persist a `Dictionary<string, object>`, reload it, and verify that a key such as `Status` remains unchanged. That protects the contract from accidental assumptions about the POCO fallback.

The corrected [`PublishEventTests`](https://github.com/elsa-workflows/elsa-core/blob/a02ebff1297e774c959b85ec2bd5cb48d1a231b5/test/component/Elsa.Workflows.ComponentTests/Scenarios/Activities/Primitives/Event/PublishEventTests.cs#L58-L122) demonstrate why this matters. Event tests can see different representations depending on whether the workflow instance is still live or has been loaded from the store. Testing only one path can turn a deterministic persistence rule into an apparently intermittent failure.

## What does the new warning tell you?

On current Elsa Core `main`, [`PolymorphicObjectConverter`](https://github.com/elsa-workflows/elsa-core/blob/1b38c3511d4d3b8fcf64c50808a406387359724c/src/modules/Elsa.Workflows.Core/Serialization/Converters/PolymorphicObjectConverter.cs#L362-L393) logs a warning when the workflow state serializer encounters an unaliased POCO. The message names the CLR type, explains that it will return as a camel-cased property bag, and points to the two remedies: register an alias or use a dictionary.

The warning is emitted once per CLR type per process, and only when warning-level logging is enabled. That keeps repeated persistence operations from flooding logs while still surfacing the risky contract.

PR #7969 does not change the fallback representation. It makes the existing lossy path visible and documents it at the `PublishEvent` boundary. This distinction matters when evaluating an upgrade: the warning is new, but the need to register durable custom types is not.

When the warning reaches the Elsa version you use, treat it as a schema review prompt:

- If consumers require the original POCO, register a stable serialization alias.
- If consumers expect flexible key-value data, publish a dictionary intentionally.
- If the warning names an anonymous type, replace it with one of those explicit contracts.
- If persisted records already exist, inspect or migrate them instead of assuming registration rewrites old JSON.

## Frequently asked questions

### Does adding an alias repair payloads already stored without one?

No. Alias registration lets Elsa write and resolve the discriminator for values processed with that configuration. It cannot infer and insert a missing `_type` into existing stored JSON. Handle those records as property bags or migrate them with application-specific knowledge.

### Can case-insensitive deserialization solve this?

It can make a DTO projection or assertion tolerant of `Status` versus `status`, but it does not restore the original payload type. Use it only when a flexible representation is acceptable, not as a substitute for a durable alias.

### Should every custom payload be a registered POCO?

No. Register POCOs that form durable typed contracts. Use `Dictionary<string, object>` when a property bag is the intended model. The important thing is to choose explicitly before the value crosses persistence.

## The practical takeaway

If a payload changes from `ShipmentPayload.Status` to an `ExpandoObject` key named `status`, the casing is the clue, not the whole problem. The workflow state no longer carries enough registered type information to rebuild the original CLR object.

Register a stable alias for every typed payload that must survive persistence. Use dictionaries deliberately for flexible data. Most importantly, test after Elsa has serialized and reloaded the workflow state. That is the path your long-running workflows eventually depend on.

## Primary sources

- [Elsa Core PR #7969: Warn when unregistered POCO payloads lose type and property casing on persistence](https://github.com/elsa-workflows/elsa-core/pull/7969)
- [Unaliased payload warning integration tests](https://github.com/elsa-workflows/elsa-core/blob/1b38c3511d4d3b8fcf64c50808a406387359724c/test/integration/Elsa.Workflows.IntegrationTests/Core/UnaliasedPayloadWarningTests.cs)
- [Workflow JSON type resolution guidance](https://github.com/elsa-workflows/elsa-core/blob/1b38c3511d4d3b8fcf64c50808a406387359724c/doc/wiki/workflow-core.md#L145-L164)
- [Elsa Core issue #7472: unsafe arbitrary CLR type resolution](https://github.com/elsa-workflows/elsa-core/issues/7472)
- [Elsa Core PR #7499: use registered aliases for workflow JSON](https://github.com/elsa-workflows/elsa-core/pull/7499)

Sources were reviewed on August 24, 2026.
