# Discord Reference

Use this reference only when executing Discord-specific sharing.

## Access Paths

- Prefer a connected Discord MCP/app/tool when available.
- Use a webhook when `DISCORD_WEBHOOK_URL`, `DISCORD_WEBHOOK_URL_BLOGPOSTS`, or another target-specific webhook variable is configured and the target channel is clear from the variable name, request, or configuration.
- Use a bot/API token only when the target server/channel IDs are explicit and the token is already configured outside chat.
- For Announcement Channel publishing/crossposting, use the webhook plus a bot token: send with `wait=true` to receive the message ID, attach required images in the original webhook message, then crosspost that message through the Discord API.
- Use the Discord web or desktop UI when the user is signed in and no API/tool is available.
- Fall back to ready-to-paste copy when no account access is available.

## Webhook Notes

Discord webhooks accept JSON posts to the webhook URL. Use plain text messages by default. Do not include `embeds`, rich embeds, or embedded cards unless the user explicitly asks for them.

A minimal payload is:

```json
{
  "content": "Message text and URL"
}
```

For blog/community announcements where the featured image must appear, use multipart form upload instead of JSON-only webhook execution. Include `payload_json` with `content`, `allowed_mentions`, and an `attachments` array, then attach the image file as `files[0]`.

For webhook use:

1. Verify the webhook destination if it is documented or returned by tooling.
2. Keep messages under Discord's content limit.
3. Use `allowed_mentions: { "parse": [] }` unless mentions were explicitly requested.
4. Send only `content`, `allowed_mentions`, and required file attachments by default. Avoid `embeds`.
5. If crossposting is needed, append `?wait=true` to the webhook URL so Discord returns the sent message object with `id` and `channel_id`.
6. Verify webhook-created messages through `GET /webhooks/{webhook.id}/{token}/messages/{message.id}` when possible. Bot reads may not reflect webhook content/attachments in some channels.
7. Report success or any Discord error response.

## Crossposting / Auto-Publish

Discord Announcement Channels require publishing/crossposting for followers to receive the message. Webhook execution alone creates the message but does not publish it to follower channels.

To auto-publish:

1. Send the webhook request with `wait=true`, including required image attachments in that original message.
2. Parse the returned `id` and `channel_id`.
3. Call:

```http
POST https://discord.com/api/v10/channels/{channel_id}/messages/{message_id}/crosspost
Authorization: Bot <DISCORD_BOT_TOKEN>
```

Use `DISCORD_BOT_TOKEN` or a more specific configured variable such as `DISCORD_BOT_TOKEN_BLOGPOSTS`. The bot must have permission to publish/crosspost messages in the Announcement Channel. If no bot token is configured, report that the message was sent but could not be auto-published.

## API/UI Notes

For bot/API use, require an explicit channel ID. Do not infer server/channel from names alone unless the tool returns an unambiguous match.

For browser/UI use:

1. Open Discord and verify the visible workspace/server.
2. Navigate to the channel from explicit user request, configured defaults, target-specific credentials, or clear project/community fit.
3. Paste the generated message.
4. Send the message and report the resulting destination and status.

## Reporting Template

After sending, report:

```text
Discord destination: <server/channel or webhook label>
Action: send message
Message:
<copy>
Link: <url>
Mentions: <none | exact mentions>
```
