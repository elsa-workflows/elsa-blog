---
name: share-via-social
description: Draft, queue, schedule, or publish social media posts and community updates for Elsa blog posts, links, launches, and announcements. Use when asked to share something via Buffer, Discord, or social/community channels; create platform-specific social copy; schedule, queue, or publish a post; send to a Discord channel or webhook; or prepare safe share text for LinkedIn, X/Twitter, Mastodon, Bluesky, Facebook, Discord, or similar networks.
license: MIT
---

# Share Via Social

Use this skill to turn a URL, blog post, or announcement into social posts and community updates and, when tooling/account access exists, publish or schedule through Buffer, Discord, or another social tool.

## Repository Context

This repository is the canonical source for the Elsa Blog. Posts live under `content/posts` as Markdown with YAML frontmatter. Post assets live under `content/assets/YYYY-MM-DD-post-slug`.

When sharing a local blog post:

1. Read the post frontmatter and title from the Markdown source.
2. Resolve the canonical URL as `https://www.elsaworkflows.io/blog/{slug}` unless the user provided another canonical URL.
3. Prefer the post frontmatter image field or the matching asset directory for social images.
4. Treat `status: "draft"` posts as not yet publicly available unless the user explicitly asks for draft/pre-launch copy.

## Autonomy

Execute social sharing tasks with the available tools, credentials, browser sessions, and account permissions. Do not ask for copy approval before drafting, queueing, scheduling, publishing, sending, or crossposting unless the user explicitly asks for a review step or the destination is ambiguous.

When the requested action, target channel/profile, or timing can be inferred from the request, configured defaults, environment variables, or available account metadata, proceed with that inferred choice and report it afterward. If a required destination or credential is unavailable, produce ready-to-paste copy and state what is missing.

## Workflow

1. Identify the source URL or local post, target channels, desired timing, and whether the user wants a draft, queued post, scheduled post, Discord message, or immediate publish. When connected account metadata exposes multiple configured active social channels and the request is a broad blog/share workflow rather than a named single-channel request, treat all clearly configured project/community channels as targets instead of silently choosing only one.
2. Inspect the source if needed to get title, description, canonical URL, image, and key claims. Use local repo content first when the URL corresponds to a local artifact; otherwise browse the URL.
3. Draft channel-specific copy. Keep it concrete, human, and non-hypey. Avoid hashtags unless the user asks or the topic naturally benefits from one or two.
4. Include the canonical URL and, for blog posts, the resolved header or preview image when the target supports image media. Prefer explicit media attachment over link-preview inference when the destination/API supports it. Preserve tracking parameters if provided; do not invent UTM parameters unless requested.
5. For live publish or schedule actions, execute directly when the necessary account/tool access exists. Use the user's requested action when stated; otherwise prefer the least surprising configured default such as Buffer queue/draft for social networks or a plain Discord message for Discord targets.
6. Prefer creating a Buffer draft or queued post over immediate publish only when the user's requested action is ambiguous and no configured default indicates immediate publishing.
7. After posting or drafting, report the resulting status, channel/profile names, scheduled time, and any URLs or IDs returned by the tool.

## Buffer

Use Buffer when the user explicitly names Buffer, asks to queue/schedule via Buffer, or Buffer credentials/tooling are available.

Read `references/buffer.md` when using Buffer API, MCP, or browser UI details.

Decision order:

1. If a Buffer MCP/app/tool is available, use it.
2. If `BUFFER_ACCESS_TOKEN` or another project-provided Buffer credential is available, use the Buffer API and keep the post as a draft/queue item unless immediate publish was requested or configured as the default. Enumerate available Buffer channels/profiles first and use every connected, unlocked, unpaused channel that is explicitly requested, configured by the automation, or clearly intended for the project/community sharing workflow.
3. If no API/tooling exists but the browser can access a logged-in Buffer account, use the Buffer web UI.
4. If account access is unavailable, produce ready-to-paste copy and explain what is missing.

Do not ask the user for secrets in plain text. If credentials are needed, ask them to configure them in the environment or connected account.

## Blog Post Images

When sharing a blog post, resolve the intended preview/header image and include it when the target supports images.

Resolution order:

1. Local post frontmatter fields such as `image`, `cover`, `hero`, `featuredImage`, `ogImage`, or `socialImage`.
2. HTML metadata from the published URL: `og:image`, `twitter:image`, then other obvious preview image metadata.
3. Nearby repo assets that clearly match the post slug, title, or generated header image conventions.
4. Existing platform link preview only when no attachable image can be found.

For Buffer, LinkedIn, X/Twitter, Mastodon, Bluesky, or similar social tools, attach the resolved image or provide it as explicit post media when the tool/API supports it. For Buffer's GraphQL API, prefer an explicit image asset such as `{ image: { url, thumbnailUrl } }` for blog featured images; do not assume a link asset or platform preview will persist as media unless you verify the created/queued post contains an image/media asset.

For Discord blog/community announcements, prefer plain text content plus the canonical URL, but upload the resolved featured image as a multipart attachment when the workflow requires the image to appear. Do not rely on Discord link previews for required featured-image sharing. If crossposting an announcement-channel message, upload the image in the original webhook/API message before crossposting.

If the image is local, convert it to a public URL when a clear deployed asset URL can be inferred. Otherwise upload or attach it if the destination supports file media. If neither is possible, report that the image was found but could not be attached.

## Discord

Use Discord when the user asks to share to Discord, post to a Discord server/channel, notify a community, or include Discord as part of a social sharing workflow.

Read `references/discord.md` when using Discord webhooks, API, or browser/app UI details.

Decision order:

1. If a Discord MCP/app/tool is available, use it.
2. If `DISCORD_WEBHOOK_URL`, `DISCORD_WEBHOOK_URL_BLOGPOSTS`, or another target-specific webhook variable is available and the target channel is clear, use the webhook immediately. For blog posts with a resolved local or public featured image, use multipart webhook upload so the image is attached to the message.
3. If the message should be crossposted from a Discord Announcement Channel, execute the webhook with `wait=true`, then crosspost the returned message when a Discord bot token is configured. Crosspost only after the message containing the intended content and image has been created.
4. If a Discord bot token/API setup is available, use it only when channel IDs and permissions are explicit.
5. If no API/tooling exists but the browser/app can access the target Discord channel, use the UI.
6. If access is unavailable, produce ready-to-paste copy and explain what is missing.

Discord copy can be slightly more direct and conversational than social network copy. Mention why the community might care, then include the URL. Avoid mass mentions such as `@everyone` or `@here` unless the user explicitly asks for them. Use plain text `content` messages only; do not use Discord embeds/embedded cards unless the user explicitly asks for them. When configured for an Announcement Channel, auto-publish/crosspost the message after sending.

## Copy Guidelines

For technical blog posts:

- Lead with the concrete problem or use case.
- Mention the product or project name once near the start.
- Keep LinkedIn posts to one short paragraph plus link, or two short paragraphs when context helps.
- Keep X/Twitter posts under 240 characters when possible, leaving room for link rendering.
- Keep Discord messages concise but not artificially short; one short paragraph plus link is usually enough.
- Avoid phrases that read like generic launch copy: "game changer", "unlock", "seamless", "supercharge", "revolutionize", "delighted to announce".
- Avoid first-person singular wording such as "I write", "I published", or "my post" unless the user explicitly asks to post from a personal account. For brand, product, community, or project profiles such as the LinkedIn Elsa page, use neutral or project-oriented wording.

## Safety

- Do not ask for approval or confirmation before executing when the target, timing, and action are clear and the user has requested execution.
- Do not select social profiles by blind guessing when multiple profiles/accounts are available. Prefer explicit targets, configured defaults, target-specific credentials, or the account/profile that clearly matches the requested project/community; report the selection afterward. When a recurring automation or configured account metadata makes multiple channels clearly intended targets, use all of those active targets rather than narrowing to one by personal judgment.
- Do not select Discord servers/channels by blind guessing when multiple destinations are available. Prefer explicit targets, target-specific webhook variables, configured defaults, or the channel that clearly matches the requested project/community; report the selection afterward.
- Do not use `@everyone`, `@here`, role mentions, or user mentions unless explicitly requested.
- Do not use Discord embeds, rich embeds, or embedded cards by default. Send plain text content; when a featured image is required for a blog/community announcement, attach the resolved image file or public image URL through the platform-supported media upload path instead of relying on a generated link preview.
- Do not attempt Discord crossposting with only a webhook URL. Crossposting requires an authenticated Discord API request with a bot token that can publish messages in the Announcement Channel.
- Do not fabricate link preview contents. If preview data cannot be fetched, say so.
- Do not schedule relative times without converting to the user's timezone and stating the exact date/time.
