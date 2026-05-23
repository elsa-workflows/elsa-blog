---
title: "Installing Docker on Raspberry Pi 4"
slug: "installing-docker-on-raspberry-pi-4"
description: "Installing Docker on Raspberry Pi 4 TLDR; To install Docker, run the following two commands on your PI (either directly or via SSH): sudo apt update -y curl -fsSL get.docker.com..."
publishedAt: "2019-11-27"
updatedAt: null
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "dotnet"
  - "docker"
  - "raspberry-pi"
sourceName: "Medium"
sourceUrl: "https://medium.com/@sipkeschoorstra/installing-docker-on-raspberry-pi-4-b010d3792b2d"
seoTitle: "Installing Docker on Raspberry Pi 4"
seoDescription: "Installing Docker on Raspberry Pi 4 TLDR; To install Docker, run the following two commands on your PI (either directly or via SSH): sudo apt update -y curl -fsSL get.docker.com..."
redirectFrom: []
---

<section><div><div><h3>Installing Docker on Raspberry Pi 4</h3><h4>TLDR;</h4><p>To install Docker, run the following two commands on your PI (either directly or via SSH):</p><pre>sudo apt update -y<br>curl -fsSL get.docker.com -o get-docker.sh &amp;&amp; sh get-docker.sh</pre></div></div></section><section><div><div><p>This is going to be a really short post, and serves more as a “note to self” than anything else.</p><p>Last week I finally allowed myself to purchase a Raspberry Pi 4, with the intent to build an IoT application with .NET Core 3.0 and drive some peripherals.</p><p>Before getting started, I wanted to prepare the Pi with Docker, so I can build and deploy my application as a container. Because that’s the cool thing to do, right?</p><p>Well, turns out that was easier said than done. I spent an entire weekend pulling out teeth and hair, to no avail.</p><p>But today my friends, I found the right combination of words to enter into Google, which allowed me to find the following Youtube video:</p><figure><iframe src="https://www.youtube.com/embed/nBwJm0onzeo?feature=oembed" width="700" height="393" frameborder="0" scrolling="no"></iframe></figure><p>I skipped the intro and jumped straight to minute 2:50 to see the magic lines that would deliver me from madness:</p><pre>curl -fsSL get.docker.com -o get-docker.sh &amp;&amp; sh get-docker.sh</pre><p>But that didn’t work right away. I first had to update my system:</p><pre>sudo apt update -y</pre><p>That was it!</p></div></div></section>
