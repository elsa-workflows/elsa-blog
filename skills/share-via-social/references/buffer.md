# Buffer Reference

Use this reference only when executing Buffer-specific sharing.

## Access Paths

- Prefer a connected Buffer MCP/app/tool when available.
- Use the Buffer API only when credentials are already configured in the environment or project.
- Use the Buffer web UI when the user is logged in locally and no API/tool is available.
- Fall back to ready-to-paste copy when no account access is available.

## API Notes

Buffer's current developer surface includes a GraphQL API documented at:

https://buffer.com/developers/api

The older REST developer API has been deprecated for new integrations in recent years, so verify the current official docs before implementing API calls.

For API use:

1. Discover available channels/profiles before creating a post.
2. Match profiles by explicit user request, configured defaults, target-specific credentials, or clear project/community fit. For broad blog-sharing automations, queue to every active configured target rather than picking only one channel.
3. For blog posts with a resolved featured image, attach the image as explicit media. With Buffer GraphQL, prefer an `AssetInput` image asset such as `{ image: { url, thumbnailUrl } }`; do not rely on a link asset to persist the preview image.
4. After creating a Buffer post, fetch or inspect the returned post and verify media was attached when the workflow required it. Treat `assets: []` as a failed image attachment, even if the post itself was accepted.
5. Create a draft or scheduled/queued item by default.
6. Use immediate publish when requested or configured as the default.
7. Capture and report returned IDs/statuses for each channel/profile.

## Browser UI Notes

When using Buffer's web UI:

1. Open Buffer and verify the logged-in workspace/account.
2. Start a new post/create flow.
3. Select the profile(s) from explicit user request, configured defaults, target-specific credentials, or clear project/community fit. For broad blog-sharing automations, select every intended active configured profile, including X/Twitter when it is part of the configured target set.
4. Paste the generated copy and URL.
5. Verify image media if required. Do not count a plain link preview as sufficient when the workflow requires the featured image to be attached.
6. Choose draft, queue, schedule, or publish according to the user's requested action or configured default.
7. Execute the action and report the resulting status, selected profile(s), timing, and any IDs or URLs.

## Reporting Template

After live action, report:

```text
Channel(s): <profiles>
Action: <draft | queue | schedule | publish now>
Time: <exact date/time and timezone, if scheduled>
Post:
<copy>
Link: <url>
```
