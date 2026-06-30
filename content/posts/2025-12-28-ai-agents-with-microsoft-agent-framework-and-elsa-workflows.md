---
title: "AI Agents with Microsoft Agent Framework and Elsa Workflows"
slug: "ai-agents-with-microsoft-agent-framework-and-elsa-workflows"
description: "Use Microsoft Agent Framework for agent collaboration, then expose that capability as an Elsa activity for long-running .NET workflows."
publishedAt: "2025-12-28"
updatedAt: "2026-06-30"
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "docker"
  - "workflow"
  - "ai-agents"
featuredImage: "https://cdn-images-1.medium.com/max/1200/1*K1pV07McSDkDHbm_2bbLKg.png"
featuredImageAlt: "AI Agents with Microsoft Agent Framework and Elsa Workflows"
sourceName: "Medium"
sourceUrl: "https://medium.com/@sipkeschoorstra/ai-agents-with-microsoft-agent-framework-and-elsa-workflows-4870e33a7134"
seoTitle: "AI Agents with Microsoft Agent Framework and Elsa Workflows"
seoDescription: "Learn where Microsoft Agent Framework workflows end, where Elsa Workflows begins, and how to expose .NET agent methods as Elsa activities."
redirectFrom: []
---

Agentic workflows are becoming a real architectural choice in .NET applications. The question is no longer whether you can call an agent from your code. You can. The harder question is where orchestration should live once that agent becomes part of a business process.

Microsoft Agent Framework gives .NET developers a strong model for agent collaboration. Elsa Workflows gives them a durable model for application orchestration. In our experience, the cleanest design is often to let each tool own the layer it is best at.

> **Key Takeaways**
> - Microsoft describes Agent Framework workflows as graph-based workflows that can include agents, external integrations, human interaction, and checkpointing.
> - Elsa Activity Hosts let public instance methods, including async methods, become workflow activities.
> - Use Agent Framework for AI collaboration. Use Elsa for long-running, visible, stateful application processes.

The sample behind this post uses three roles: a writer agent, an editor agent, and an Elsa workflow that can call the story-writing capability as an activity. The source is available in the [Elsa code-first agents sample](https://github.com/elsa-workflows/elsa-samples/tree/release/3.6.0/src/aspnet/Elsa.Samples.AspNet.CodeFirstAgents).

## What Are We Building?

Microsoft's workflow overview says Agent Framework workflows can model business processes that include multiple agents, external systems, human interactions, and checkpoints ([Microsoft Learn](https://learn.microsoft.com/en-us/agent-framework/workflows/index)). In this walkthrough, we keep the example small: a writer creates a story draft, an editor improves it, and Elsa decides where that capability sits in the broader process.

The important design move is incremental. We start with an agent-native workflow, package it behind a normal .NET class, then expose that class to Elsa. After that, we can decide whether Elsa should call one composite agent capability or orchestrate several smaller agent activities directly.

The sample moves through four stages:

1. Build a Writer to Editor pipeline with Microsoft Agent Framework.
2. Encapsulate that pipeline in `StoryWriterAgent`.
3. Register `StoryWriterAgent` in ASP.NET Core dependency injection.
4. Expose `WriteStoryAsync` as an Elsa activity through `AddActivityHost<StoryWriterAgent>()`.

That last step matters. It lets application code stay ordinary, while Elsa provides persistence, visual modeling, API-driven workflow management, and the operational surface you need around the capability. This is similar in spirit to the design trade-offs in [reusable triggers in Elsa 3.5](/blog/reusing-triggers-in-elsa-workflows-3-5): reusable application behavior becomes easier to reason about when it has a clear boundary.

## Where Should Agent Framework Own Orchestration?

Microsoft's `AgentWorkflowBuilder.BuildSequential` API builds a pipeline where one agent's output becomes the next agent's input ([Microsoft Learn API reference](https://learn.microsoft.com/en-us/dotnet/api/microsoft.agents.ai.workflows.agentworkflowbuilder.buildsequential)). That is a good fit when the flow is primarily about AI collaboration: draft, critique, revise, classify, route, or hand off.

In the current sample, the agent code is deliberately small. The `StoryWriterAgent` receives an `IChatClient`, turns it into two AI agents, builds a sequential workflow, runs it, and returns the generated text. The current sample uses `AsAIAgent`, `AgentWorkflowBuilder.BuildSequential`, and `workflow.AsAgent()` in [`StoryWriterAgent.cs`](https://github.com/elsa-workflows/elsa-samples/blob/release/3.6.0/src/aspnet/Elsa.Samples.AspNet.CodeFirstAgents/Agents/StoryWriterAgent.cs).

```csharp
public class StoryWriterAgent(IChatClient chatClient)
{
    public async Task<string> WriteStoryAsync(
        string topic,
        string genre,
        CancellationToken cancellationToken = default)
    {
        var writer = chatClient.AsAIAgent(
            name: "Writer",
            instructions: "Write a short story based on the provided topic.");

        var editor = chatClient.AsAIAgent(
            name: "Editor",
            instructions: "Improve the draft: fix grammar, improve flow, and tighten the plot.");

        var workflow = AgentWorkflowBuilder.BuildSequential(writer, editor);
        var workflowAgent = workflow.AsAgent();

        var result = await workflowAgent.RunAsync(
            $"Write a short story about {topic} in the genre of {genre}.",
            cancellationToken: cancellationToken);

        return result.Text;
    }
}
```

This is a sensible place for Agent Framework to own orchestration. The flow is short. The participants are agents. The value is in how the model-backed actors collaborate. If you later add a reviewer, classifier, or handoff step, it still belongs inside the agent capability as long as the surrounding application treats the result as one unit of work.

## Why Put The Agent Behind A Plain .NET Class?

The official Agent Framework workflow builder page describes workflows as directed graphs that coordinate executor invocation, message routing, and event streaming ([Microsoft Learn](https://learn.microsoft.com/en-us/agent-framework/workflows/workflows)). That is useful, but your application should not have to know those internals every time it needs a story. A plain class gives the rest of the system one stable method to call.

That boundary pays off quickly:

- Controllers can call `StoryWriterAgent` directly.
- Background services can call it without depending on Elsa.
- Tests can replace `IChatClient` or the whole agent service.
- Elsa can expose the method as an activity without a hand-written activity wrapper.

This is the same discipline you would apply to any integration. The AI part should not force the whole application to become agent-shaped. Keep the capability behind a focused service, then decide which orchestration layer should call it.

The sample registers the class as a singleton:

```csharp
services.AddOpenAIChatClient("gpt-4o", openApiKey);
services.AddSingleton<StoryWriterAgent>();
```

From there, a normal Minimal API endpoint can invoke it:

```csharp
app.MapPost(
    "/write-story",
    async (StoryWriterAgent agent, CancellationToken cancellationToken) =>
        await agent.WriteStoryAsync("A haunted lighthouse", "thriller", cancellationToken));
```

At this point, Elsa is not required. That is intentional. If the only thing you need is an HTTP endpoint that calls an agent workflow, keep it simple.

## How Do Elsa Activity Hosts Change The Integration?

Elsa's Activity Host API registers a host type through workflow management by adding it to `HostMethodActivitiesOptions` in the Elsa core source. Component tests verify that public instance methods are registered as activities, while static methods are excluded, and async methods can expose inputs and outputs. That gives `StoryWriterAgent.WriteStoryAsync` a direct path into Elsa Studio.

The sample registers the host in [`Program.cs`](https://github.com/elsa-workflows/elsa-samples/blob/release/3.6.0/src/aspnet/Elsa.Samples.AspNet.CodeFirstAgents/Program.cs):

```csharp
builder.Services.AddElsa(elsa =>
{
    elsa.UseWorkflowManagement(management =>
    {
        management.UseEntityFrameworkCore(ef => ef.UseSqlite());
        management.UseCache();
    });

    elsa.UseWorkflowRuntime(runtime =>
    {
        runtime.UseDistributedRuntime();
        runtime.UseEntityFrameworkCore(ef => ef.UseSqlite());
        runtime.UseCache();
    });

    elsa.UseWorkflowsApi();
    elsa.AddActivityHost<StoryWriterAgent>();
    elsa.UseDefaultAuthentication();
});
```

That one registration changes how the application can be composed. `WriteStoryAsync` becomes an activity. Its `topic` and `genre` arguments become configurable inputs. The returned `string` becomes the activity result.

![Elsa Studio showing the generated Write Story activity](https://cdn-images-1.medium.com/max/1200/1*WvMheAeFhDlvx6dGlKbIFw.png)

There is no separate `WriteStory : CodeActivity<string>` class in this path. You can still write custom activities when you need fine-grained metadata, custom execution behavior, bookmarks, or designer-specific options. But for many service methods, Activity Hosts remove a layer of mechanical code.

If you are already organizing Elsa through shell-level features, the same idea composes well with [configuring Elsa with shell features](/blog/configuring-elsa-with-shell-features): register the agent capability where the feature lives, and let the shell decide which activities belong in that runtime.

## When Should Elsa Become The Primary Orchestrator?

Agent Framework workflows and Elsa workflows solve different problems. Microsoft's workflow docs describe Agent Framework workflows as supporting graph control flow, checkpointing, multi-agent orchestration, and human-in-the-loop patterns. Elsa focuses on long-running application workflows: triggers, bookmarks, persistence, explicit activity graphs, runtime APIs, and Studio visibility.

The practical rule is simple: use Agent Framework when the flow is inside the AI capability, and use Elsa when the AI capability is one step in a larger business process.

For example, keep orchestration inside Agent Framework when you need:

- A writer, editor, and reviewer agent to collaborate on one answer.
- A classifier agent to route work to specialized agents.
- An agent pipeline that returns one result to the application.

Move orchestration into Elsa when you need:

- A human approval step after the agent produces content.
- A durable process that resumes after minutes, days, or external events.
- Operational visibility over retries, failures, incidents, and state.
- A workflow that mixes AI with HTTP calls, timers, user tasks, secrets, logs, and domain services.

That distinction becomes more important as workflows grow. Elsa 3.8, for example, adds operational features such as [structured logs](/blog/structured-logs-in-elsa-3-8), [console logs](/blog/console-logs-in-elsa-3-8), [OpenTelemetry diagnostics](/blog/opentelemetry-diagnostics-in-elsa-3-8), and [workflow alterations](/blog/workflow-alterations-in-elsa-3-8). Those are application workflow concerns. They help teams operate a process, not just get one AI answer.

## What Does The Split Look Like In Practice?

Start with one composite activity when the agent collaboration is an implementation detail. A workflow designer sees "Write Story", provides a topic and genre, and receives a result. That is enough for content generation, draft creation, enrichment, and similar steps.

Split the agents into separate activities when business users need to control the process around them. For example, you might expose:

```csharp
public class WriterAgent
{
    public Task<string> WriteDraftAsync(string topic, string genre, CancellationToken cancellationToken);
}

public class EditorAgent
{
    public Task<string> EditDraftAsync(string draft, CancellationToken cancellationToken);
}
```

Then Elsa can place a review activity between writing and editing. It can branch based on human feedback. It can send the draft to a moderation API before the editor runs. It can retry only the failed step.

That is the architectural pivot point. Once each agent is a workflow activity, Elsa owns the process and the agents own their narrow capability. This usually makes the system easier to operate because every step has an explicit place in the workflow graph.

![Elsa Studio login screen for the sample](https://cdn-images-1.medium.com/max/1200/1*xcQzlFyeui_ECHiUMVa1ug.png)

## Agent Framework Workflows Vs Elsa Workflows

The two workflow models are complementary, not competing. Microsoft Agent Framework is a good fit for AI-centric orchestration because its workflows can treat agents as first-class participants and compose them into reusable patterns. Elsa is a good fit for application orchestration because it models durable, event-driven, observable processes.

Use this table as a starting point:

| Question | Prefer Agent Framework | Prefer Elsa Workflows |
| --- | --- | --- |
| What owns the flow? | Agent collaboration | Business process |
| What changes often? | Prompts, model behavior, agent routing | Process rules, approvals, integrations |
| What needs visibility? | Agent events and output | Workflow state, incidents, logs, retries |
| What is the unit of reuse? | Agent or agent workflow | Activity, trigger, workflow definition |
| What is the failure model? | Retry or adjust the AI task | Resume, compensate, alter, or retry process steps |

The split is not always obvious at the start. That is fine. A good default is to hide agent collaboration behind a plain .NET method first. If the surrounding process later needs more control, split the capability into smaller Activity Hosts and let Elsa orchestrate them.

## FAQ

### Do I need Elsa to use Microsoft Agent Framework?

No. If your application only needs to call an agent workflow and return a result, a controller, Minimal API endpoint, or background service is enough. Add Elsa when the agent sits inside a longer process that needs persistence, visual modeling, retries, events, or human approval.

### Do I need a custom Elsa activity for every agent?

No. Activity Hosts can expose public methods on regular .NET classes as activities. A custom `CodeActivity` still makes sense when you need custom metadata, designer behavior, bookmarks, or low-level workflow control, but simple service methods can usually stay as service methods.

### Should Elsa orchestrate every agent individually?

Not by default. If the writer and editor agents form one cohesive capability, expose one `WriteStoryAsync` activity. Split them only when the workflow itself needs to place business steps between them, such as approval, moderation, enrichment, or escalation.

## Closing Thoughts

The best part of this integration is that it does not force a false choice. Microsoft Agent Framework gives .NET developers a way to build agentic capabilities. Elsa gives those capabilities a durable place in a real workflow system.

Keep the boundary explicit. Let Agent Framework handle agent collaboration. Let Elsa handle the business process around it. When you do that, you get systems that can be intelligent without becoming opaque, and operational without burying the AI work behind boilerplate.

The complete sample is available in the [Elsa Workflows samples repository](https://github.com/elsa-workflows/elsa-samples/tree/release/3.6.0/src/aspnet/Elsa.Samples.AspNet.CodeFirstAgents).
