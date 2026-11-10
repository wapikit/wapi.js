# wapi.js overhaul: audit and TODO (v0.2.0 beta)

This document records the end-to-end audit of `@wapijs/wapi.js` 0.1.x, the
gap against its Go sibling [`wapi.go`](https://github.com/wapikit/wapi.go)
(v0.8.x), and the work list for the `0.2.0`
beta line. Items are checked off as they land on the `beta` branch.

Legend: **[B]** = bug, **[S]** = security, **[P]** = bad library practice,
**[G]** = gap against wapi.go / the Cloud API, **[R]** = release & project hygiene.

---

## 1. Bugs found in 0.1.x

| # | Area | Problem | Impact |
|---|------|---------|--------|
| B1 | webhook | `NotificationMessageTypeEnum.Video = "Video"` (capital V). Meta sends `"video"`. | **Video messages never emit an event.** |
| B2 | webhook | Location event sets `longitude: message.location.latitude`. | Every received location has the wrong longitude. |
| B3 | webhook | Image and video events build the component with `id: message.id` (the *message* id) instead of the media id. | Re-sending/forwarding a received image/video fails. |
| B4 | webhook | Status events (`sent`/`delivered`/`read`/`failed`) do not carry the message id. | Impossible to correlate a status with the message you sent. |
| B5 | webhook | Status `failed` without an `errors` array is silently dropped; `undelivered` is only inferred from error code `130472`. | Lost failure events. |
| B6 | webhook | A single unknown or malformed field fails Zod parsing for the **whole** payload and returns HTTP 500. | Meta retries the entire batch, re-delivering events already handled, and eventually disables the webhook. |
| B7 | webhook | `GET` verification ignores `hub.mode`, and a request without `hub.verify_token` never gets a response. | Hanging requests; non-standard verification. |
| B8 | webhook | `server.on("error")` is attached to the Express *app*, not the HTTP server. `listen()` sets `listening = true` before the port is bound. | Port-in-use and other server errors are never reported; status lies. |
| B9 | client | `Ready` fires, but there is no way to stop the server (no `close()`), no graceful shutdown. | Leaks in tests, can't restart. |
| B10 | message events | `reply()`, `react()` and `read()` always use the client's single `phoneNumberId`, not the number the message was received on. | Replies go out from the wrong number on multi-number WABAs. |
| B11 | request client | HTTP status is never checked; non-JSON bodies (e.g. HTML 502 from a proxy) throw an opaque `SyntaxError`. | Opaque failures, no retry signal. |
| B12 | request client | No timeout. | A stalled Graph API call hangs the bot forever. |
| B13 | message manager | Unparseable success response throws `"Report to sarthak@softlancer.co urgently"`. | Leaks a personal email; useless to callers. |
| B14 | media manager | `delete()` calls `DELETE /{mediaId}`; `getUrl` parses strictly and throws a generic error. No upload, no download. | Media API mostly unusable. |
| B15 | template message | `TemplateMessage` sets `type = interactive`, `addComponent()` is a TODO, components are never serialised. | **Template messages (required to start a conversation) cannot be sent with parameters.** |
| B16 | contacts event | Contacts with `org`, `birthday` are dropped; `Contact` setters partially implemented. | Data loss. |
| B17 | `CustomerIdentityChanged` | Reads `message.identity`, which Meta no longer sends for system messages. | Dead code path / crash risk. |
| B18 | `UnknownEvent` | Only reads the first error, codes coerced to `""`. | Debug info lost. |
| B19 | package | `"types": "dist/cjs/index.js"` points to a JS file; the ESM build has extension-less imports and no `"type": "module"`, so `import` from Node ESM fails. | Broken typings and broken ESM consumers. |
| B20 | package | `@microsoft/api-extractor` and `express` are runtime `dependencies`. | Every consumer installs a doc generator and Express. |
| B21 | `constants.ts` | Error-code table is the same placeholder copied 14 times. | Misleading. |

## 2. Security

- **S1** No `X-Hub-Signature-256` verification. Anyone who knows the webhook URL can forge inbound messages. *(wapi.go: `WebhookAppSecret` + `VerifyWebhookSignature`, constant-time compare, 401 on mismatch.)*
- **S2** `express.json()` discards the raw body, which makes signature verification impossible even for users who want to add it.
- **S3** The access token is a public mutable property (`requester.accessToken`) and is logged by `console.error` paths on payload errors (whole payload dumped).
- **S4** Built-in server binds on all interfaces with no option to choose the host.

## 3. Bad library practices

- **P1** Library calls `console.error` directly. Should go through a pluggable logger (default: silent / `console` at `warn`).
- **P2** Event handlers that throw or reject bubble into the webhook request, and an async handler rejection becomes an unhandled rejection. *(wapi.go recovers handler panics and logs them.)*
- **P3** Hard dependency on Express and a hard-wired port; users with their own server (Next.js, Hono, Fastify, Bun, Cloudflare Workers, Lambda) cannot mount the handler. *(This is the "server options" problem: wapi.go exposes `GetWebhookGetRequestHandler()` / `GetWebhookPostRequestHandler()` so callers mount them in their own server.)*
- **P4** Setters named like methods (`set updateAccessToken`, `set updateSenderPhoneNumberId`), getter named `getReadyAtTimestamp`, static `getClient()` returning the class, not an instance.
- **P5** Errors returned as `{status: "error"}` objects from some calls and thrown from others. Need one consistent model: throw a typed `GraphApiError` (with HTTP status, code, subcode, `fbtraceId`, `isRetryable`).
- **P6** Every class has a mirror `interface` file duplicating doc comments; ~45 deep-path `export *` lines in `index.ts`. Hard to maintain, no tree-shaking boundaries.
- **P7** Runtime Zod parsing of every inbound webhook with strict schemas couples us to Meta's schema drift (see B6).
- **P8** No tests at all; `turbo test` is a no-op.
- **P9** API version pinned to `v19.0` with no override; Graph base URL not overridable (can't test against a mock server).
- **P10** Single global phone number per client; no way to send from multiple numbers.
- **P11** `Client extends EventEmitter` and overrides `emit` publicly, so users can emit fake library events.

## 4. Gap against wapi.go

| Capability | wapi.go | wapi.js 0.1 | Target 0.2 |
|---|---|---|---|
| Multiple messaging clients (one per phone number id) | ✅ `NewMessagingClient(id)` | ❌ | ✅ `client.messaging(id)` |
| Typed Graph API error, `isRetryable` | ✅ | ❌ | ✅ |
| Configurable HTTP client / API version / base URL, timeouts | ✅ | ❌ | ✅ |
| Webhook signature verification | ✅ | ❌ | ✅ |
| Bring-your-own server handlers | ✅ | ❌ | ✅ Node `http`, Fetch API, Express |
| Lenient webhook parsing (skip bad change, still 200) | ✅ | ❌ | ✅ |
| Status events: message id, recipient, pricing, conversation, errors | ✅ | ❌ | ✅ |
| BSUID / username identity fields (`user_id`, `parent_user_id`, `from_user_id`, `username`) | ✅ | ❌ | ✅ |
| Send to BSUID / parent BSUID (`recipient`) | ✅ | ❌ | ✅ |
| Marketing Messages Lite API (`/marketing_messages`) | ✅ | ❌ | ✅ |
| Mark as read + typing indicator | ✅ | partial | ✅ |
| Media upload / get URL / delete / download | ✅ | partial | ✅ |
| Template messages with header/body/button params, named params, carousel, LTO, catalog, MPM/SPM | ✅ | ❌ | ✅ |
| CTA URL, location request, contact request, catalog, product, product list interactive messages, header/footer on list & button | ✅ | partial | ✅ |
| Template manager (create, update, delete, fetch, paginated list, migrate) | ✅ | ❌ | ✅ |
| Phone number manager (fetch, create, request/verify code, register/deregister, QR codes, username) | ✅ | ❌ | ✅ |
| Catalog manager (catalogs, products, paginated) | ✅ | ❌ | ✅ |
| Business account (fetch, analytics, conversation analytics) | ✅ | ❌ | ✅ |
| Business webhooks: template status/quality/category/components, phone number name/quality, account update/review/alerts, business capability, security, user preferences, payment config, SMB app state sync, SMB message echoes, history, user id update, business username update | ✅ | ❌ | ✅ |
| Ad referral on any message type (not only text), welcome message text | ✅ | ❌ | ✅ |

Known wapi.go bugs **not** to port (to fix upstream separately): several business
webhooks are published under `AccountAlertsEventType` instead of their own event
type (`account_review`, `business_capability`, template status/quality/category,
phone number name/quality, `security`).

## 5. Release & project hygiene

- **R1** No prerelease channel. Add a `beta` branch to semantic-release (`prerelease: true`), published to npm under the `beta` dist-tag so `npm i @wapijs/wapi.js` keeps installing 0.1.x until 0.2.0 is promoted.
- **R2** Versioning: stay on 0.x (wapi.go is also 0.x). Breaking changes bump the **minor** during 0.x, so this line is `0.2.0-beta.N`, then `0.2.0`.
- **R3** CI: run build, typecheck, lint and tests on PRs (currently only build+lint on push, and the lint job throws when no PR exists).
- **R4** Release workflow: run on `master` and `beta`; drop unused `NPM_USERNAME/PASSWORD/EMAIL` secrets; keep provenance.
- **R5** Repository URLs are inconsistent (`sarthakjdev/wapi.js`, `wapijs/wapi.js`, `wapikit/wapi.js`). Use `wapikit/wapi.js` everywhere.
- **R6** Personal emails in `package.json` and error messages.
- **R7** Announce the beta: README banner, docs page, `MIGRATION.md`, `CHANGELOG` notes, pinned GitHub issue/discussion.
- **R8** Build with `tsup` (correct dual ESM/CJS + `.d.ts`/`.d.cts`), `sideEffects: false`, Node `>=20`.

---

## 6. TODO (0.2.0 beta)

### Core
- [x] `RequestClient`: `fetch` with per-request timeout + `AbortSignal`, configurable `fetch`, API version (default `v20.0`, same as wapi.go), base URL; non-2xx → `GraphApiError`; JSON-safe parsing; query/fields builder; multipart.
- [x] `GraphApiError` with `status`, `code`, `subcode`, `type`, `fbtraceId`, `details`, `body`, `isRetryable`.
- [x] `Client` config object; `client.messaging(phoneNumberId)` returning a cached `MessagingClient` (message + media + phone-number scoped calls).
- [x] Pluggable `logger` option; no direct `console` use.
- [x] Typed event emitter: `on/once/off`, sync **and** async handler errors are caught and re-emitted as `error`; never crash the webhook.

### Webhook
- [x] Core `WebhookHandler.handle({ method, query, headers, rawBody })` independent of any framework.
- [x] `X-Hub-Signature-256` verification (`appSecret` option) with `timingSafeEqual`; exported `verifyWebhookSignature()`.
- [x] `GET` verification checks `hub.mode === "subscribe"` and always responds.
- [x] Lenient parsing: skip and log undecodable changes/messages, always `200` once the payload is authenticated JSON.
- [x] Adapters: `nodeHandler()` (`http.IncomingMessage`), `fetchHandler()` (`Request → Response`), `expressHandler()` (works with `express.raw()` or a pre-parsed body).
- [x] Optional built-in server (`node:http`), configurable `host`/`port`/`path`, `listen()` returns a promise, `close()`.
- [x] All message types: text, image, audio (voice flag), video, document, sticker (animated), location, contacts, interactive (button/list reply, nfm reply), button (quick reply), reaction, order, system, unsupported/unknown; referral → `AdInteraction` for any type.
- [x] Status events with message id, recipient id, BSUID fields, pricing, conversation, errors, biz opaque callback data; `failed`/`undelivered` with error code/title/message.
- [x] Business account events (full list in section 4).

### Messaging
- [x] `send`, `reply`, `sendMarketing` to phone or BSUID targets; returns `{ messageId, contacts }` or throws `GraphApiError`.
- [x] `markAsRead(messageId, { typingIndicator })`.
- [x] `register(pin)` / `deregister()`.
- [x] Media: `upload`, `getUrl`/`getMetadata`, `delete`, `download`.
- [x] Event helpers `reply()`, `react()`, `markAsRead()` on message events use the receiving phone number id.

### Components
- [x] Port/repair every builder to wapi.go parity (text w/ preview URL, media, location, location request, contact request, contacts, reaction, buttons, list, CTA URL, product, product list, catalog, template incl. carousel/LTO/catalog/MPM/coupon/OTP/flow buttons, named params).

### Business
- [x] Template manager, phone number manager (+username), catalog manager, business account client.

### Quality & release
- [x] Vitest unit tests: request client, signature, webhook dispatch (fixtures per message type), components `toJson`, managers against a mocked `fetch`.
- [x] tsup dual build, correct `exports`/`types`, remove runtime doc deps.
- [x] CI on PRs (Node 20/22/24), semantic-release `beta` channel.
- [x] `MIGRATION.md`, README beta banner, docs page, examples + `create-wapi-app` templates updated to the new API.
- [ ] Pinned GitHub issue / discussion announcing the beta (maintainer).
- [ ] Regenerate `apps/docs/api-reference` with `pnpm --filter @wapijs/wapi.js doc:gen`.
- [ ] Verify against the live Graph API: analytics filter syntax, template button `index` type, business webhook field names.

## 7. wapi.go bugs found during the port (to fix upstream)

The JS port does **not** copy these.

1. **Business webhook field names.** wapi.go matches `message_template_status`, `message_template_quality`, `phone_number_name`, `phone_number_quality`, `account_review`, `business_capability` and `template_category`, but Meta sends `message_template_status_update`, `message_template_quality_update`, `phone_number_name_update`, `phone_number_quality_update`, `account_review_update`, `business_capability_update` and `template_category_update`. The switch has no `default`, so these events are likely dropped silently. wapi.js accepts both spellings.
2. Eight business webhooks are published as `AccountAlertsEventType`; `security` publishes an empty `SecurityEvent{}`.
3. `account_update.restriction_info` is modelled as one object with a string `expiration`; Meta sends a list with numeric expirations, which fails decoding and drops the change.
4. Fields parsed but never surfaced: template status `disable_info`/`other_info`/`rejection_info`, template category `correct_category`, phone quality `old_limit`, SMB echo content (`json:"-"`).
5. `TemplateManager.Delete` is an empty stub; `MigrateFromOtherBusinessAccount` uses GET (Meta: POST); template `Update` decodes `{success}` as a create response.
6. `PhoneNumberManager.FetchAll(getSandBoxNumbers)` ignores its argument; `GetQrCodeById` returns a list type.
7. `FetchAnalytics` decodes analytics from the top level (they are under `analytics`), `ConversationAnalytics` expects an array where Meta returns an object, `Cost` is an int, and list filters are rendered comma separated with singular names (`conversation_category`) instead of Meta's JSON arrays and plural names.
8. Components: contact address serialises `countryCode` (Meta: `country_code`); `Org` and some headers are not pointers so empty objects are sent; `NewVideoMessage` drops the caption; product list sends a stray `product_retailer_id`; list `SetBodyText(section)` uses the section title; template media parameters only support `link`.
9. Media `DeleteMedia` calls `DELETE /media/{id}`; Meta documents `DELETE /{media-id}`.
