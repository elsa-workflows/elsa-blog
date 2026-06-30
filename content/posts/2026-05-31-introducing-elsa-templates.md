---
title: "Introducing Elsa Templates for dotnet new"
slug: "introducing-elsa-templates"
description: "Elsa Templates provides dotnet new templates for scaffolding Elsa Server, Elsa Studio, and combined Elsa applications with explicit hosting choices."
publishedAt: "2026-05-31"
updatedAt: "2026-06-30"
status: "published"
authors:
  - "sipke"
category: "Product"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "templates"
  - "developer-experience"
featuredImage: "../assets/2026-05-31-introducing-elsa-templates/featured.png"
featuredImageAlt: "Generated technical illustration showing project template blocks flowing from a terminal into workflow, server, and Studio-style application components"
seoTitle: "Introducing Elsa Templates for dotnet new"
seoDescription: "Scaffold Elsa Server, Elsa Studio, and combined Elsa applications with dotnet new templates for hosting, persistence, auth, and feature models."
redirectFrom: []
---

Starting a new Elsa application should not begin with copying a sample host and deleting the parts you do not need.

That works once or twice. After that, the small choices start to pile up. Do you want only Elsa Server, or Studio as well? Should Studio run as Blazor Server, Blazor WebAssembly, or a hybrid host? Which EF Core persistence provider should the server use? Should the server use static feature registration, or the CShells-based model?

In our experience, those first setup choices are where teams either get momentum or start treating the framework as something they have to reverse-engineer from samples.

**Elsa Templates** is a `dotnet new` template package that turns those choices into explicit command-line options. The repository is [elsa-workflows/elsa-templates](https://github.com/elsa-workflows/elsa-templates), and the package is published as `Elsa.Templates`.

![Generated technical illustration showing project template blocks flowing from a terminal into workflow, server, and Studio-style application components](../assets/2026-05-31-introducing-elsa-templates/featured.png)

> **Key Takeaways**
> - Elsa Templates currently defines `elsa-server`, `elsa-studio`, and `elsa-combined`.
> - The templates expose choices for feature model, persistence, Studio hosting, authentication, and optional Labels support.
> - Smoke tests pack the templates, install them into an isolated template hive, generate supported outputs, and build the generated solutions.

## What Do Elsa Templates Generate?

The repository README lists three templates: `elsa-server`, `elsa-studio`, and `elsa-combined` ([README](https://github.com/elsa-workflows/elsa-templates/blob/main/README.md)). Each template generates normal .NET projects, not a special runtime format. You can open the output, change it, and treat it as application code.

The server template focuses on the backend workflow host:

```bash
dotnet new elsa-server -n MyElsaServer --feature-model static
dotnet new elsa-server -n MyElsaServer --feature-model shell

dotnet new elsa-server -n MyElsaServer --persistence sqlite
dotnet new elsa-server -n MyElsaServer --persistence sqlserver
dotnet new elsa-server -n MyElsaServer --persistence postgresql
dotnet new elsa-server -n MyElsaServer --persistence oracle
```

The Studio template focuses on the UI host:

```bash
dotnet new elsa-studio -n MyElsaStudio --hosting server
dotnet new elsa-studio -n MyElsaStudio --hosting wasm
dotnet new elsa-studio -n MyElsaStudio --hosting hybrid
```

It also exposes authentication and optional Labels support:

```bash
dotnet new elsa-studio -n MyElsaStudio --auth-provider elsa-identity
dotnet new elsa-studio -n MyElsaStudio --auth-provider open-id-connect
dotnet new elsa-studio -n MyElsaStudio --auth-provider elsa-login --with-labels
```

The combined template gives you Server and Studio in one solution:

```bash
dotnet new elsa-combined -n MyElsaApp --feature-model static --studio-hosting server
dotnet new elsa-combined -n MyElsaApp --feature-model shell --studio-hosting wasm
dotnet new elsa-combined -n MyElsaApp --feature-model shell --studio-hosting hybrid --persistence postgresql --auth-provider open-id-connect --with-labels
```

The goal is not to hide Elsa. The goal is to start from a working baseline that already matches your first architectural choice.

## Why Does This Matter?

Templates are not glamorous, but they shape first impressions. If the first step is copy, paste, delete, and guess, people assume the rest of the framework will feel the same. If the first step gives them a working host with the right package set, they can spend their attention on the workflow they came to build.

Elsa has several valid starting points:

- Embed workflows in an existing ASP.NET Core application.
- Run Elsa Server separately and use Studio as the operational UI.
- Start with SQLite for evaluation.
- Use PostgreSQL, SQL Server, or Oracle from day one.
- Use OpenID Connect because the rest of the environment already does.
- Use CShells-based feature registration for a modular host.

That last point connects directly to [building modular .NET applications with CShells](/blog/building-modular-dotnet-applications-with-cshells), [building multitenant web apps with CShells](/blog/building-multitenant-web-apps-in-dotnet-with-cshells), and [configuring Elsa with shell features](/blog/configuring-elsa-with-shell-features). Different teams start from different runtime shapes. A single starter project would hide those choices. A template can make them explicit.

For example:

```bash
dotnet new elsa-combined \
  -n ExpenseApprovals \
  --feature-model shell \
  --studio-hosting hybrid \
  --persistence postgresql \
  --auth-provider open-id-connect \
  --with-labels
```

That command says quite a lot. It asks for a modular server, hybrid Studio hosting, PostgreSQL persistence, OpenID Connect authentication, and Labels support. The generated solution should reflect that, without making the developer assemble it by hand.

## How Are Versions Handled?

The repository's version policy is intentionally boring. `main` tracks the latest stable Elsa release. At repository creation time, that baseline was Elsa `3.7.0`. Version-specific branches can target exact stable or preview versions such as `3.7.0`, `3.8.0-preview`, or `3.8.0-preview.1234`.

That matters because templates are only useful if the generated output restores and builds. A template package that mixes stable and preview dependency lines creates confusion at the worst possible time: the first few minutes of a new project.

The README also calls out a practical constraint: the stable template package exposes options that restore and build against stable Elsa packages. Preview-only Studio modules and the current MySQL EF provider are intentionally not exposed from `main`.

That keeps the default path predictable.

## How Are The Templates Tested?

The smoke tests do more than inspect template files. They pack the template package, install it into an isolated template hive, generate projects or solutions for supported option combinations, and run `dotnet build` on the generated `.slnx` output.

The test suite covers:

- both server feature models: `static` and `shell`
- server persistence providers: `sqlite`, `sqlserver`, `postgresql`, and `oracle`
- Studio hosting modes: `server`, `wasm`, and `hybrid`
- Studio auth choices with Labels in representative combinations
- combined Server and Studio combinations

The test source is available in [`TemplateSmokeTests.cs`](https://github.com/elsa-workflows/elsa-templates/blob/main/test/Elsa.Templates.Tests/TemplateSmokeTests.cs). One small but important check also asserts generated hosts do not map health checks to `/`, because that would interfere with normal app routes.

This is the right kind of test for templates. The user experience is install, generate, restore, build. The tests should follow the same path.

## How Do You Install Them?

For stable builds, use the standard .NET template flow:

```bash
dotnet new install Elsa.Templates
```

For preview builds, use the Elsa preview feed and specify the preview version:

```bash
dotnet new install Elsa.Templates@<preview-version> --add-source https://f.feedz.io/elsa-workflows/elsa-3/nuget/index.json
```

You can also install from source:

```bash
dotnet pack src/Elsa.Templates/Elsa.Templates.csproj
dotnet new install artifacts/package/release/Elsa.Templates.*.nupkg
```

After that, `dotnet new list elsa` should show the Elsa template short names.

## FAQ

### Are Elsa Templates a runtime feature?

No. They do not change workflow execution, persistence, Studio behavior, or deployment. They generate starter solutions that use existing Elsa packages and conventions.

### Should every Elsa app start from `elsa-combined`?

No. `elsa-combined` is useful for local evaluation and internal workflow apps where Server and Studio can live together. Use `elsa-server` when the backend host is separate. Use `elsa-studio` when you only need the UI solution.

### Why not just keep sample applications?

Samples are good for teaching specific ideas. Templates are better for starting real projects because they let you choose the hosting, persistence, auth, and feature model up front, then generate a solution with those choices already applied.

## Closing Thoughts

Elsa Templates is deliberately practical work. It does not add a new runtime concept. It removes a small but repeated source of friction from the start of a project.

That is still worth doing. Workflow engines are usually adopted inside real applications, where persistence, authentication, hosting, and deployment decisions are already waiting. A good template cannot make those decisions disappear, but it can give you a clean starting point for the decisions you have already made.
