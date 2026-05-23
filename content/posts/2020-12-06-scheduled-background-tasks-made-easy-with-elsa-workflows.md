---
title: "Scheduled Background Tasks made easy with Elsa Workflows"
slug: "scheduled-background-tasks-made-easy-with-elsa-workflows"
description: "Photo by Estée Janssens Implementing background tasks could hardly be any simpler with ASP.NET Core..."
publishedAt: "2020-12-06"
updatedAt: "2020-12-07"
status: "published"
authors:
  - "sipke"
category: "Tutorial"
tags:
  - "aspnetcore"
  - "elsa"
  - "quartz"
  - "workflow"
featuredImage: "https://dev-to-uploads.s3.amazonaws.com/uploads/articles/3otvb2z646ytpt1hl2rv.jpg"
featuredImageAlt: "Scheduled Background Tasks made easy with Elsa Workflows"
sourceName: "DEV Community"
sourceUrl: "https://dev.to/sfmskywalker/scheduled-background-tasks-made-easy-with-elsa-workflows-3o6k"
seoTitle: "Scheduled Background Tasks made easy with Elsa Workflows"
seoDescription: "Photo by Estée Janssens Implementing background tasks could hardly be any simpler with ASP.NET Core..."
redirectFrom: []
---
![Photo by Estée Janssens](https://dev-to-uploads.s3.amazonaws.com/i/08ue6x1inu6fkvhdsuin.jpg)
*Photo by [Estée Janssens](https://unsplash.com/@esteejanssens)*

Implementing background tasks could hardly be any simpler with ASP.NET Core today. But when it comes to scheduling background tasks, what do you do?

As it turns out, you have a number of very attractive options available to you. Specifically, I’m thinking:

* ASP.NET Core Hosted Service
* Quartz.NET
* Elsa Workflows (the reason you are reading this post)

We’ll take a brief look at each of these options and see how they compare.

## Hosted Service
If all you need is a recurring task that executes at a set interval, the simplest option (without taking on any external package dependencies) might be to implement a Hosted Service and perform work in an infinite loop until the cancellation token is triggered.

For example:

{% gist https://gist.github.com/sfmskywalker/c80e0197b69e7657e51b31caaea8ab86 %}

This is perfectly fine for performing work in the background at a specific interval. But what if you want to schedule work using more advanced schedules, like using a cron schedule?

As demonstrated in [this article](https://codeburst.io/schedule-cron-jobs-using-hostedservice-in-asp-net-core-e17c47ba06), you might implement that as a hosted service yourself. But it does require quite a bit of code.

So what about Quartz.NET?

## Quartz.NET
[Quartz.NET](https://www.quartz-scheduler.net/) is an open source scheduling system for .NET that is flexible and easy to use. It offers many features that makes scheduling jobs super-easy.

With Quartz.NET, you get all sorts of scheduling options in the form of triggers, which include simple triggers and cron triggers.

To implement a job that executes on a given schedule, all you need to do is implement a Job class that performs the work, register it with Quartz, and then schedule it using one or more triggers.

For example:

{% gist https://gist.github.com/sfmskywalker/cbeb0972dd116a1fd458ee2792da22aa %}

This might be all you need to implement scheduled jobs.

But there’s a third option that makes this easier, more flexible and even more powerful.

## Elsa Workflows
[Elsa Workflows](https://github.com/elsa-workflows/elsa-core/tree/feature/elsa-2.0) is an open source library for .NET that enables applications to implement both short-running and long-running workflows, either in code, using a designer, or both.

Even if you have zero interest in working with workflow systems and designers, Elsa comes with an easy to use API to implement background tasks.

The Elsa equivalent of a Hosted Service in .NET Core and a Job in Quartz.NET is the **Workflow**.

> As a matter of fact, Elsa Workflows’ scheduling mechanism directly uses Quartz.NET to schedule work at a given time.

To implement a workflow, all you have to do is implement `IWorkflow` and register it with DI. That’s it.

For example, to implement a scheduled job, you could create the following workflow:

{% gist https://gist.github.com/sfmskywalker/336f83284673e0f71d2a3899b9ae61e7 %}

And then register it with DI like this:

```csharp
services
   .AddElsa()
   .UseConsoleActivities()
   .UseTimerActivities()
   .AddWorkflow<MyJob>();
```

Yep, that’s pretty easy.

Of course, most background jobs will do a little bit more than just printing the current date and time to the console. For example, you may want to clean out the trash every *Monday morning at 08:00*:

{% gist https://gist.github.com/sfmskywalker/6f5465e5d04d01853a6ba54ea7145910 %}

Looks pretty neat!

Not only does Elsa simplify declaring scheduled tasks with this simple API, it automatically opens the door for you to implement actual workflow stuff (since after all, this is a real workflow!).

For instance, after cleaning out the trash, you may want to sleep for a while, walk the dog and do some dishes, perhaps something like this:

{% gist https://gist.github.com/sfmskywalker/d2d5c8150c93c5ba128b45acd65d19c9 %}

Notice that in this version of the workflow, there are two time-based triggers:

1. Cron (which starts the workflow ever Monday morning at 08:00)
2. Timer (which starts ticking after the trash has been cleaned).

Implementing this with Quartz.NET would require you to manually schedule a new job, possibly from some event handler raised by the clean up service. Doable, but increasingly harder to follow as complexity increases.

And of course it would be quite sad for the dog to be walked on Monday mornings only. Fortunately Elsa makes it easy to fix that by just declaring another workflow class that takes good care of the dog.

To learn more about Elsa, checkout the [project on GitHub](https://github.com/elsa-workflows/elsa-core/tree/feature/elsa-2.0).

> Note: the Elsa-related code described in this article targets Elsa 2.0-preview.

## Summary
So there you have it! We looked at 3 viable options of implementing scheduled tasks in .NET Core / .NET 5.

The **Hosted Service** option is great for simple, recurring schedules and requires no external packages. But if you want cron schedules, you better pull up your sleeves and start writing some code.

Next, we looked at **Quartz.NET**, which I think is pretty awesome for implementing background tasks.

Finally, we looked at **Elsa Workflows**, which I think is another great choice to make implementing background tasks a real breeze. And being a workflow, it automatically enables you to implement more complex, long-running process flows, where you can mix & match any kind of trigger beyond time-based events. Examples include service bus messages, HTTP requests, application-specific events, and virtually anything you can dream up.