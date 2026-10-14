---
title: "Two Weeks of Elsa: A Friendlier Studio, a Steadier 3.x, and Sharper BPMN"
slug: "elsa-progress-update-october-2026"
description: "A plain-language tour of two weeks of Elsa: copy and paste in the Elsa 4 preview designer, the Elsa 3.9.0 release and fixes, and BPMN library progress."
publishedAt: "2026-10-14"
status: "published"
authors:
  - "sipke"
category: "Product"
tags: ["studio", "devjournal"]
seoTitle: "Elsa Progress Update: Studio, Elsa 3.9 and BPMN"
seoDescription: "Copy and paste in the Elsa 4 preview designer, the Elsa 3.9.0 release, and what's next for the BPMN library for .NET."
excerpt: "Copy and paste in the Elsa 4 preview designer, a steadier Elsa 3.x, and BPMN getting sharper."
featuredImage: "../assets/2026-10-14-elsa-progress-update-october-2026/featured.png"
featuredImageAlt: "A glossy workflow designer panel with blue nodes, one being duplicated, beside a stack of teal blocks and violet BPMN-style shapes."
related:
  - "building-elsa-4-week-17"
  - "bpmn-for-dotnet-shared-core-for-elsa-4-and-elsa-3"
---

# Two Weeks of Elsa: A Friendlier Studio, a Steadier 3.x, and Sharper BPMN

The last two weeks were busy ones, and a lot of it is stuff you'll actually notice. So let me give you a quick tour: what changed, why it matters, and what's next.

## Elsa 4 (preview): the Studio is getting good

First, a quick reminder: Elsa 4 is still a **preview**. Things will change, and I wouldn't run production on it yet. That said, the Studio took some big steps this time.

**Copy, paste and duplicate in the designer.** This one came up a lot, and I get why. Until now, if you wanted a second copy of an activity you had already configured, you had to drag a new one from the palette and fill in every input again. Not anymore. Select some activities and press Ctrl/Cmd+C and Ctrl/Cmd+V, or duplicate one from its context menu or with Ctrl/Cmd+D. The copies keep their settings and the connections between them, they get sensible names like "Write Line (copy)", and a single undo takes the paste back out. A small thing on paper, but it really changes how designing a workflow feels.

**A Classic look, and more control over appearance.** Classic is now the default theme for Elsa Studio 4, so if you're coming from Elsa 3 it should feel familiar. There's also a new Settings area with an Appearance page, including a System mode that follows your OS and a reset button. In addition, activities now have their own icons in the palette and on the canvas (extension packages can bring their own), the Home page can be customized, and the bottom console starts closed so you have more room to work.

**Persistence modes.** Workflows can now run in Durable, Balanced or Ephemeral mode, with Balanced as the default. In short: you choose how much a run writes to the database, and trade a bit of safety for speed where that makes sense.

**Housekeeping.** Honestly, a big part of the work was cleanup. We reorganized Foundation and Studio into a clearer layout of Essentials, Extensions and Studio, and we're making internals "internal by default", one area at a time. That keeps the public surface you build on small and deliberate. We also stopped building Docker images on every pull request; they're now built only when changes are merged into main. Less waste, and the images you pull are the ones that actually landed. And we rewrote a good chunk of the docs to make them easier to read, with Studio screenshots added.

## Elsa 3.x: 3.9.0 is out, plus a bunch of fixes

For those of you running Elsa 3 in production: **Elsa 3.9.0** shipped on October 4, together with matching Studio and Extensions releases. The headline is a new permission-based access model. The dashboard is now open to every signed-in user, and each part of it shows only what that user is allowed to see. Elsa Identity also has a proper sign-out now, and we closed several gaps in tenant isolation. If you use multitenancy, please read the upgrade notes before rolling it out.

Since then, a steady stream of fixes landed on main. A few examples:

- User Tasks can now be defined in JSON workflows, and a few edge cases around completing tasks were fixed.
- The workflow definition cache no longer holds on to "not found" results, and it refreshes after you publish, retract or delete.
- Secrets are kept out of persisted activity state.
- Invalid label names now return a clear error instead of a server error, and tenant activation failures are reported instead of silently swallowed.
- Fixes to scheduling (cron format errors), background activity bookmarks and the outbox.

Behind the scenes, we also brought Elsa 3 Studio, Extensions and Apps into the core repository (the templates are following, with the final cutover in progress), which makes maintaining 3.x a lot simpler going forward.

## BPMN: getting the tricky parts right

Our open source BPMN 2.0 library for .NET (under Valence Works) keeps maturing. Version 0.2.0 was the release where the interpreter itself went stable, and since then the focus has been on correctness in the tricky corners of BPMN. The main piece in progress right now makes sure that when a process is terminated or faults, its scope ends right away and any work that's still running gets properly torn down. Because hosts can observe that change in behavior, it's flagged as breaking, so expect it in an upcoming release rather than a quiet patch.

## What's next

For Elsa 4, we keep pushing toward parity with the Elsa 3 Studio experience, so expect more designer conveniences and polish. For 3.x, more fixes and maintenance releases. And for BPMN, we'll land the termination work and cut the next release.

Thanks to everyone testing previews, filing issues and sending pull requests. It really does shape where we go. If you give the Elsa 4 preview a try, I'm curious to hear what you think!
