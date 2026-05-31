---
title: "Introducing Elsa Templates"
slug: "introducing-elsa-templates"
description: "Elsa Templates provides dotnet new templates for scaffolding new Elsa Server, Elsa Studio, and combined Elsa applications without copying sample hosts by hand."
publishedAt: "2026-05-31"
updatedAt: null
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
seoTitle: "Introducing Elsa Templates"
seoDescription: "Scaffold new Elsa Server, Elsa Studio, and combined Elsa applications with dotnet new templates."
redirectFrom: []
---

# Introducing Elsa Templates

Starting a new Elsa application should not begin with copying a sample host and then deleting the parts you do not need.

That works once or twice. After that, the small choices start to pile up:

- do you want an Elsa Server only, or Studio as well?
- should Studio run as Blazor Server, WebAssembly, or a hybrid setup?
- which persistence provider should the server use?
- do you want static feature registration, or the CShells-based modular setup?
- which authentication provider should Studio be wired for?

None of these choices are difficult on their own. But together they make the first few minutes of a new Elsa project more fiddly than they need to be.

So I created [elsa-workflows/elsa-templates](https://github.com/elsa-workflows/elsa-templates): a set of .NET solution templates for getting new Elsa projects off the ground with `dotnet new`.

## What the templates generate

The repository currently contains three templates.

`elsa-server` creates an Elsa Server host. It supports static feature registration as well as the newer CShells-based feature model, and it lets you choose an EF Core persistence provider:

```bash
dotnet new elsa-server -n MyElsaServer --feature-model static
dotnet new elsa-server -n MyElsaServer --feature-model shell

dotnet new elsa-server -n MyElsaServer --persistence sqlite
dotnet new elsa-server -n MyElsaServer --persistence sqlserver
dotnet new elsa-server -n MyElsaServer --persistence postgresql
dotnet new elsa-server -n MyElsaServer --persistence oracle
```

`elsa-studio` creates an Elsa Studio solution. The useful bit here is that Studio is not a single shape. Depending on the application, you might want Blazor Server, Blazor WebAssembly, or a hybrid setup where the host can decide how Studio starts.

```bash
dotnet new elsa-studio -n MyElsaStudio --hosting server
dotnet new elsa-studio -n MyElsaStudio --hosting wasm
dotnet new elsa-studio -n MyElsaStudio --hosting hybrid
```

It also supports the authentication options we tend to reach for when building real Elsa applications:

```bash
dotnet new elsa-studio -n MyElsaStudio --auth-provider elsa-identity
dotnet new elsa-studio -n MyElsaStudio --auth-provider open-id-connect
dotnet new elsa-studio -n MyElsaStudio --auth-provider elsa-login --with-labels
```

`elsa-combined` generates a Server and Studio solution together. This is probably the one many people will start with when they are trying Elsa locally or building an internal workflow app:

```bash
dotnet new elsa-combined -n MyElsaApp --feature-model static --studio-hosting server
dotnet new elsa-combined -n MyElsaApp --feature-model shell --studio-hosting wasm
dotnet new elsa-combined -n MyElsaApp --feature-model shell --studio-hosting hybrid --persistence postgresql --auth-provider open-id-connect --with-labels
```

The point is not to hide how Elsa works. The generated projects are normal .NET projects. You can open them, change them, remove what you do not need, and treat them like application code.

The point is to start from a working baseline.

## Why this matters

Templates are not glamorous infrastructure, but they have an outsized effect on how a framework feels.

If the first step is messy, people reasonably assume the rest will be messy too. If the first step gives them a working host, a sensible project layout, and the right packages wired together, they can spend their attention on the workflow they actually want to build.

For Elsa, that matters because there are several valid starting points.

Some applications embed workflows into an existing ASP.NET Core system. Some run Elsa Server separately and use Studio as an operational UI. Some need PostgreSQL from day one. Some are still fine with SQLite while they explore. Some teams want OpenID Connect immediately because that is how everything in their environment is secured.

There should not be one blessed starter project that quietly assumes all of those choices.

`dotnet new` is a good fit for this because it lets the choices be explicit:

```bash
dotnet new elsa-combined \
  -n ExpenseApprovals \
  --feature-model shell \
  --studio-hosting hybrid \
  --persistence postgresql \
  --auth-provider open-id-connect \
  --with-labels
```

That command says quite a lot about the kind of application you want to build, and it gives you a solution shaped accordingly.

## Versioned with Elsa

One design choice in the templates repository is that `main` tracks the latest stable Elsa release. At the time the repository was created, that baseline is Elsa `3.7.0`.

Version-specific branches can target exact stable or preview versions, for example:

- `3.7.0`
- `3.8.0-preview`
- `3.8.0-preview.1234`

This is important because templates are only useful when the generated output actually restores and builds. A template that points at packages from two different release lines is worse than no template at all.

The stable template package exposes the options that build against stable Elsa packages. Preview-only modules stay on preview branches and preview packages. That is a small constraint, but it keeps the default path boring in the best sense of the word.

## Tested as generated projects

The smoke tests for the repository pack the template package, install it into an isolated template hive, generate the supported option combinations, and build the generated outputs.

That last part matters.

It is easy for a template to look correct as a set of files while still failing once `dotnet restore` or `dotnet build` runs. The tests exercise the templates the same way users will: install, generate, restore, build.

```bash
dotnet test test/Elsa.Templates.Tests/Elsa.Templates.Tests.csproj
```

The goal is not just to ship template files. The goal is to make sure the generated applications remain valid as Elsa evolves.

## Installing

The template package is `Elsa.Templates`.

For stable builds, installation is the standard .NET template flow:

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

The repository is here:

[https://github.com/elsa-workflows/elsa-templates](https://github.com/elsa-workflows/elsa-templates)

## A small thing, but a useful one

Elsa Templates is deliberately practical work. It does not add a new runtime feature. It does not change how workflows execute.

It removes some friction from the beginning of a project.

That is still worth doing. A workflow engine is usually adopted in the middle of a real application, with persistence choices, authentication requirements, hosting preferences, and deployment constraints already waiting in the room. Good templates cannot make those decisions disappear, but they can give you a clean starting point for the decisions you have already made.

And sometimes that is exactly what you need.
