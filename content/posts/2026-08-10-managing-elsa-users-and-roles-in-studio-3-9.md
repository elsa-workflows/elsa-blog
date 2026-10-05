---
title: "Managing Elsa Users and Roles in Studio 3.9"
slug: "managing-elsa-users-and-roles-in-studio-3-9"
description: "Elsa 3.9 changes permission names, adds a live catalog, adapts Studio to least-privilege roles, and revokes refresh sessions on the server at sign-out."
publishedAt: "2026-08-10"
updatedAt: "2026-10-05"
status: "published"
authors:
  - "sipke"
category: "Engineering"
tags:
  - "elsa-workflows"
  - "dotnet"
  - "elsa-studio"
  - "identity"
  - "security"
featuredImage: "../assets/2026-08-10-managing-elsa-users-and-roles-in-studio-3-9/featured.png"
featuredImageAlt: "A secure Elsa Studio administration workspace organizing users, roles, and permission keys."
seoTitle: "Managing Elsa Users and Roles in Studio 3.9"
seoDescription: "Elsa 3.9 changes permission names, adds a live catalog, adapts Studio to least-privilege roles, and revokes refresh sessions on the server at sign-out."
redirectFrom:
  - "/blog/managing-elsa-users-and-roles-in-studio-3-8"
related:
  - "elsa-3-8-stable-upgrade-guide"
  - "openid-connect-in-elsa-studio"
  - "tenant-isolation-elsa-3-9-persistence"
---

# Managing Elsa Users and Roles in Studio 3.9

Elsa Studio 3.8 introduced screens for managing users and roles. Elsa 3.9 turns that administration feature into a broader access model: permissions use a new grammar, the server publishes its permission catalog, Studio adapts its menus and actions to the signed-in user, and the dashboard can serve useful data without granting access to everything.

That makes 3.9 a breaking security upgrade, not just a UI refresh. A role that still contains `read:workflow-definitions` will not authorize the corresponding 3.9 endpoints. The replacement is `workflows/definitions:view`, and some legacy permissions expand into more than one new grant.

> **Key Takeaways**
> - Upgrade Core, Studio, and Extensions to 3.9.0 together.
> - Re-author legacy `verb:resource` permissions as `resource:verb`; do not swap the two halves mechanically.
> - Use the server's permission catalog to build narrow roles, and treat Studio's hidden controls as guidance rather than the security boundary.
> - Apply the `RevokedSessions` migration before relying on Elsa Identity sign-out with EF Core.

> **Availability:** [Elsa Core 3.9.0](https://github.com/elsa-workflows/elsa-core/releases/tag/3.9.0), [Elsa Studio 3.9.0](https://github.com/elsa-workflows/elsa-studio/releases/tag/3.9.0), and [Elsa Extensions 3.9.0](https://github.com/elsa-workflows/elsa-extensions/releases/tag/3.9.0) were published on October 4, 2026. The release notes require the three package families to be upgraded together.

This post covers Elsa's own identity records and API permissions. If Studio signs users in through an external provider, [OpenID Connect in Elsa Studio](/blog/openid-connect-in-elsa-studio) explains the separate authentication boundary.

If you are still on an older 3.8 patch, the [Elsa 3.8 stable upgrade guide](/blog/elsa-3-8-stable-upgrade-guide) explains why Core, Studio, and Extensions must already be kept on an aligned package train.

## What changed between Elsa 3.8 and 3.9?

Elsa 3.9 replaces flat permission strings with structured resource and verb pairs. It also adds permission discovery, current-user introspection, permission-aware Studio navigation, per-widget dashboard checks, and session revocation. These changes let a restricted account use the parts of Studio it actually needs without treating a visible screen as proof of authorization.

The practical differences are:

- `read:user` becomes `identity/users:view`.
- `update:role` becomes `identity/roles:update`.
- a bare `*` still grants everything and is normalized to `*:*`;
- `GET /identity/permissions` lists the resources and verbs registered by the installed modules;
- `GET /identity/me/permissions` returns the current caller's effective grants;
- Studio hides unavailable navigation and actions, shows a consistent access-denied page, and sends a user to the first page they can open;
- the dashboard is available to every signed-in user, but each section and widget checks the permission of its own data; and
- Elsa Identity sign-out revokes the refresh-token session on the server.

The [3.9 authorization migration guide](https://github.com/elsa-workflows/elsa-core/blob/3.9.0/doc/migrations/authorization-model.md) is explicit about the break: legacy permissions stop authorizing, and the startup validator reports stored values that no longer resolve. Upgrade a non-admin test account before production so a wildcard administrator does not hide mistakes in narrower roles.

## The Elsa 3.9 permission grammar

A 3.9 permission is `{resource}:{verb}`. Resources can be hierarchical, verbs do not imply one another, and wildcards must cover a whole verb or a valid resource subtree. `workflows/definitions:view` therefore grants one operation on one resource, while `workflows/*:view` covers `view` across that resource subtree.

These examples are valid:

| Grant | Meaning |
| --- | --- |
| `identity/users:view` | Read Elsa Identity users. |
| `identity/roles:update` | Update roles. |
| `workflows/definitions:*` | Use every registered verb on workflow definitions. |
| `workflows/*:view` | View the workflows resource and its descendants. |
| `*:view` | View every registered resource, including ones added later. |
| `*` | Grant everything. Use this only for a fully trusted administrator. |

Two migration details deserve extra care. First, the resource comes before the verb. `view:workflows/definitions` is not a 3.9 permission. Second, some old values expand. For example, `read:workflow-definitions` maps to both `workflows/definitions:view` and `workflows/definitions/versions:view`. The old `read:*` was a literal string used by a limited set of endpoints; its apparent replacement, `*:view`, is a real wildcard and is much broader.

There is no general implication between verbs. Holding `view` does not grant `execute`, and `write` does not grant `publish`. That is useful when the same person may inspect a definition but must not run or publish it.

## Building a least-privilege role

Start from the deployed server, not from a hard-coded permission list. Elsa 3.9's `GET /identity/permissions` endpoint returns the catalog contributed by the modules in that host. The caller needs `identity/roles:view`, because the response describes what a role may contain. Custom and extension modules can add resources and verbs, so another deployment may expose a different catalog.

A practical role-authoring loop looks like this:

1. Sign in with an account that may view roles.
2. Read `GET /identity/permissions` and identify the smallest resource and verb pairs for the job.
3. Create or update the role in **Administration > Identity & access**.
4. Assign the role to a test user.
5. Sign in as that user and call `GET /identity/me/permissions` to inspect the effective grants.
6. Exercise the exact Studio page and API operation the role needs.
7. Add a missing leaf permission only when the failed request shows it is required.

The server is the source of truth in both discovery calls. The [catalog endpoint](https://github.com/elsa-workflows/elsa-core/blob/3.9.0/src/modules/Elsa.Identity/Endpoints/Permissions/List/Endpoint.cs) returns registered descriptors, while the [current-user endpoint](https://github.com/elsa-workflows/elsa-core/blob/3.9.0/src/modules/Elsa.Identity/Endpoints/Me/Permissions/Endpoint.cs) evaluates those descriptors for the caller. Neither response replaces authorization at the protected endpoint.

Do not grant `*` just to make one screen load. Find the request that returned `403`, match it to the catalog, and grant the smallest accepted permission. A `401` usually means the request was not authenticated; a `403` means the authenticated principal did not satisfy the endpoint's permission or another policy.

## What does a restricted user see in Studio 3.9?

Studio 3.9 uses the caller's permission snapshot to remove dead ends without inventing a second authorization system. Menus, pages, and in-page actions can each declare a requirement. A hidden create button is clearer than a button that always fails, while direct navigation to a blocked page produces one consistent access-denied view instead of exposing a raw API exception.

The dashboard shows how this model composes. Every signed-in user can reach it, but workflow metrics require `workflows/instances:view`, runtime status requires `workflows/runtime:view`, and diagnostic widgets use their respective log permissions. The older `dashboard:view` remains an accepted umbrella grant, so existing dashboard roles continue to work. A custom dashboard contribution that declares no data permission still requires `dashboard:view`.

Core also avoids work the caller cannot use. A request with neither `dashboard:view` nor `workflows/instances:view` does not query the workflow-instance store just to return unauthorized instance data. [Core PR #8562](https://github.com/elsa-workflows/elsa-core/pull/8562) introduced per-section capabilities, and [Studio PR #1103](https://github.com/elsa-workflows/elsa-studio/pull/1103) applies the same idea to dashboard widgets.

<!-- [UNIQUE INSIGHT] -->

UI gating is still only presentation. Core checks the permission again for every protected API request. This matters especially for external identity providers: Studio 3.9 preserves compatibility when a third-party token has no `permissions` claim, so the UI can behave as it did before, but the server still accepts or rejects each request. Map trusted provider roles, groups, or scopes into Elsa's literal `permissions` claim when you want the UI and API to agree.

## What prevents an administrator from escalating privileges?

Operation permissions control the requested verb, and role-content checks control the authority being delegated. A caller with `identity/users:create` can create a user, but cannot attach a role whose permissions exceed the caller's own effective grants. The same containment check applies when roles are created or changed.

Core resolves every requested role ID, collects its permissions, and evaluates them through the same permission matcher used by endpoints. That preserves wildcard semantics. An administrator holding `workflows/*:view` may delegate `workflows/definitions:view`, but someone holding only that leaf cannot delegate the broader subtree. The [3.9 role authorization service](https://github.com/elsa-workflows/elsa-core/blob/3.9.0/src/modules/Elsa.Identity/Services/RoleAuthorizationService.cs) also refuses malformed permissions because Core cannot safely reason about what they cover.

This is why role IDs and permission strings should come from the server. Studio sends role IDs when it updates a user, and the server rejects missing roles or authority the caller does not hold. A handcrafted request cannot bypass the checks that Studio would have applied to its controls.

## How do you bootstrap the first administrator?

Elsa 3.9 removes the `SecurityRoot` policy and its localhost grant. Network position is not an identity, especially behind a reverse proxy, container port mapping, or development tunnel. Bootstrap the first administrator with `DefaultAdminUser` or configure an admin API key instead.

A code-first host can seed an administrator like this:

```csharp
services.AddElsa(elsa =>
{
    elsa
        .UseIdentity(identity =>
        {
            identity.UseDefaultAdmin(
                "admin",
                "REPLACE_WITH_SECURE_BOOTSTRAP_PASSWORD",
                "admin",
                new List<string> { "*" });
        })
        .UseDefaultAuthentication();
});
```

The initializer is idempotent. Keep the password outside source control, rotate it after bootstrap according to your security policy, and retire any admin API key that is no longer needed. If no user exists and neither bootstrap option is configured, 3.9 logs an actionable startup error instead of leaving operators with unexplained `403` responses.

<!-- [UNIQUE INSIGHT] -->

There is one important 3.9 multitenancy limitation. When several tenants share an identity store, role IDs are derived from role names, so only the first tenant can seed the default `admin` role successfully. The fix in [Core PR #8616](https://github.com/elsa-workflows/elsa-core/pull/8616) targets 3.10 and was deliberately not backported. Do not present that fix as 3.9 behavior. On 3.9, do not rely on same-named seeded roles across tenants in one shared store; use a separately verified bootstrap plan for each tenant or wait for 3.10. The full boundary is tracked in [Core issue #8615](https://github.com/elsa-workflows/elsa-core/issues/8615).

For the wider persistence boundary, including tenant-owned reads and writes, see [Tenant Isolation in Elsa 3.9 Persistence](/blog/tenant-isolation-elsa-3-9-persistence).

## What does sign-out revoke?

Elsa Identity sign-out now calls `POST /identity/logout` and revokes the whole refresh-token session. That closes the old gap where Studio discarded browser tokens but a copied refresh token could continue producing new access tokens. The endpoint is idempotent and revokes every refresh token issued within the same session.

Apply the `RevokedSessions` migration before upgraded EF Core hosts begin refreshing tokens. Elsa runs it automatically when startup migrations are enabled. Without EF Core persistence, revocations live in memory, which is suitable only for a single node. Dapper and MongoDB do not provide a shared revoked-session store in 3.9.

Sign-out does not invalidate the current access token. The default access-token lifetime drops from one hour to 15 minutes in 3.9, so an issued token remains usable until it expires. Changes to Elsa roles and permissions take effect at token refresh or expiry; grants changed at an external identity provider require a fresh sign-in. Studio also needs a page reload before a changed permission set is reflected in the current UI. There is no sign-out-everywhere operation yet.

Those limits make the boundary precise: 3.9 revokes future refreshes for one sign-in session, not every credential and not every already-issued access token.

## What should you check during an upgrade?

Treat identity and Studio access as an upgrade test of their own. The aligned 3.9 release notes linked above name the package, schema, and host changes that matter.

Use this checklist before rollout:

- align Core, Studio, and Extensions on 3.9.0;
- inventory every stored, configured, and externally mapped permission;
- replace legacy values from the official migration table, reviewing expansions and wildcards by hand;
- configure `DefaultAdminUser` or an admin API key before removing any localhost bootstrap dependency;
- apply the EF Core `RevokedSessions` migration;
- rebuild custom `IAccessTokenIssuer` implementations for the new session-aware overload;
- test one wildcard administrator and at least one narrow role;
- verify the dashboard, workflow designer, Users, and Roles pages with that narrow role;
- test `401` and `403` handling through the real Studio host; and
- sign out, then confirm the session's refresh token returns `401`.

Do not use an all-powerful account as the only acceptance test. It proves the host starts, but not that the role migration or permission-aware UI is correct.

## Frequently asked questions

### Do old Elsa 3.8 permissions still work in 3.9?

No. Legacy strings such as `read:user` and `read:workflow-definitions` no longer authorize 3.9 endpoints. Re-author roles with the official mapping. Some values expand into multiple grants, and `read:*` must not be converted automatically to the much broader `*:view` wildcard.

### Does hiding a button in Studio secure the operation?

No. Studio uses permissions to improve navigation and avoid actions the caller cannot perform, but Core remains the authorization boundary. Every protected API request is checked again. If you build another client, it receives the same `401` or `403` response for the same principal.

### Where does Studio get the list of available permissions?

Studio reads the permission catalog from `GET /identity/permissions`. Installed modules contribute their own descriptors, so the deployed host is authoritative. `GET /identity/me/permissions` separately reports the current caller's effective grants and is useful when a page or action is missing.

### Does sign-out immediately invalidate every token?

No. Elsa Identity revokes refresh tokens in the current sign-in session. Existing access tokens remain valid until they expire, up to the configured lifetime, and independent sign-in sessions are unaffected. Tabs and Blazor Server circuits sharing the signed-out session may encounter the revocation on a later server call.

### Can every tenant use an `admin` role in a shared 3.9 store?

Not safely with the released 3.9 role-ID behavior. The first tenant can claim the name-derived ID, while later tenants cannot seed the same default role. The generated-ID, tenant-scoped fix is on `main` for 3.10, not in the 3.9.0 packages.

## The practical takeaway

Elsa 3.9 makes least-privilege Studio access much more usable, but it also asks operators to be explicit. Migrate permission values, discover capabilities from the running host, verify a narrow account, and keep the server as the final authority.

The fastest useful test is simple: create one role that can view workflow definitions but cannot publish them, sign in as a user holding that role, and trace what Studio shows and what the API rejects. That single path exercises the new grammar, catalog, UI gating, and endpoint enforcement without hiding mistakes behind `*`.
