---
title: "One Repo for Elsa 3"
slug: "one-repo-for-elsa-3"
description: "Elsa 3 Studio, Extensions and Apps now live in elsa-core. Here is what moved, what stays the same, and how to file issues and contribute."
publishedAt: "2026-10-14"
status: "published"
authors:
  - "sipke"
category: "Community"
tags: ["architecture"]
seoTitle: "One Repo for Elsa 3: Studio, Extensions and Apps in elsa-core"
seoDescription: "Elsa 3 Studio, Extensions and Apps now live in elsa-core. What moved, what stays the same, and how to contribute now."
excerpt: "Studio, Extensions and Apps have moved into elsa-core, so there is one place to file issues, follow changes and contribute."
---

# One Repo for Elsa 3

If you have ever filed an Elsa issue, there is a good chance you had to stop and think first. Is this a Studio bug or a Core bug? Does this activity live in Extensions? Where do the Docker images come from? And which repo has the project templates again?

That question had no great answer, because Elsa 3 was spread across several repositories. Over the past few weeks we have brought them together. Elsa Studio, Elsa Extensions and the Elsa apps now all live in one place: [elsa-core](https://github.com/elsa-workflows/elsa-core).

This post explains what moved, what did not change, and what it means for you.

## What moved

Everything that makes up Elsa 3 now sits side by side in one repository, each in its own folder:

- **Core**, the workflow engine itself, under `core/`.
- **Studio**, the Blazor dashboard for designing and managing workflows, under `studio/`.
- **Extensions**, the modules and activities that plug into Elsa, under `extensions/`.
- **Apps**, the ready to run server and Studio hosts and the container images built from them, under `apps/`.

Studio and Extensions came in first, in late September, and Apps followed in October. The project templates now live alongside the core too, with the final cutover in progress.

One thing mattered a lot to me here: we did not just copy files over. We brought in the full history of each repository. Every commit, and every person who contributed to Studio, Extensions or Apps over the years, is still there and still credited. If you run a blame on a Studio file today, you will still see who wrote it and why.

## What did not change

This was a move, not a rewrite. A few things stay exactly as they were:

- **Package names stay the same.** Moving a project to a new folder does not change its NuGet package. The `Elsa.*` packages you reference today are the same ones, and so are the Studio npm packages.
- **Each product still builds on its own.** Core, Studio, Extensions and Apps keep their own boundaries. A Studio fix does not force a new Core release, and the other way around.
- **Your workflows are untouched.** Moving code did not change any activity identities either, so the activities your workflows use are still the same activities.

## What about the old repositories?

The old Studio, Extensions and Apps repositories still exist for now, but they are no longer where development happens. New work goes into elsa-core.

As for open issues and pull requests in those repositories, we went through every one of them and recorded what happens to each. When an old issue becomes active work again, we pick it up in elsa-core, link back to the original and keep the original author credited. So if you reported something there in the past, it has not been forgotten.

## What this means for you

Here is the short version:

- **Filing an issue?** Open it in elsa-core, no matter which part of Elsa 3 it is about. Just mention which product (for example Core, Studio, Extensions or Apps) and which version you are on. That helps us a lot.
- **Sending a pull request?** Fork elsa-core and target `main`, as before. The repository has one solution that covers Core, Extensions, Studio and Apps, plus focused solution filters for each product, so you can open just the part you are working on.
- **Following changes?** Watch one repository instead of several. The roadmap lives there too. Studio and Extensions releases do not ship from elsa-core just yet: the upcoming 3.10 release will be the first one released from this single repository.
- **Using Elsa in your app?** Nothing to do. Keep referencing the same packages.

## Why I wanted this

Honestly, this was about removing friction. Splitting Elsa across many repositories made sense at the time, but it pushed a lot of small costs onto you: guessing where to report a bug, keeping track of changes in several places, and fixes that touched Studio and Core at once needing two coordinated pull requests. For us, it meant keeping several sets of tooling, docs and guidelines in sync.

Now a change that crosses Studio and Core can land as one pull request, reviewed in one place. The docs, the contribution guide and the issue tracker all point the same way.

## Thank you

A move like this only works because of the people who built those repositories in the first place. To everyone who contributed to Studio, Extensions and Apps: your work and your names came along with the code.

If you notice something that still points to an old repository, or you get lost finding your way around the new layout, please open an issue in elsa-core and let us know. I would love to hear how it works for you.
