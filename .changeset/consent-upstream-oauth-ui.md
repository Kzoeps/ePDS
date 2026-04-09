---
'epds': patch
---

The permissions shown on the sign-in approval screen now match what the app actually asked for.

**Affects:** End users, Client app developers, Operators

**End users:** When you sign in to a third-party app through ePDS and
are asked to approve what the app can do with your account, the list
you see now reflects the permissions that particular app actually
requested. Previously the screen always showed the same hard-coded
list ("Read and write posts", "Access your profile", "Manage your
follows") no matter which app you were signing in to, which was
misleading. The approval screen itself also now looks and behaves
like the standard AT Protocol consent screen used elsewhere in the
ecosystem.

**Client app developers:** The consent screen rendered at
`/oauth/authorize` is now the stock `@atproto/oauth-provider`
`consent-view.tsx`, driven by the real `scope` / `permissionSets`
your client requests. The previous auth-service implementation
ignored the requested scopes entirely. After OTP verification and
(for new users) account creation, `epds-callback` now binds the
device session via `upsertDeviceAccount()` and redirects through
`/oauth/authorize`, so the upstream `oauthMiddleware` runs
`provider.authorize()` — including `checkConsentRequired()` — against
the actual request. Clients that only need scopes the user has
already approved will now be auto-approved instead of being shown a
redundant consent screen.

**Operators:** On upgrade, the `client_logins` table is dropped by
migration v8. Consent state now lives in the upstream provider's
`authorizedClients` tracking, so nothing else needs to move. No
configuration changes are required.
