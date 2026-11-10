<div align="center">
<br />
<p align="center">
<a href="https://javascript.wapikit.com"><img src="https://mintlify.s3-us-west-1.amazonaws.com/na-730c8179/assets/banner.svg" alt="wapi.js" /></a>
</p>
<br />
<p>
  <a href="https://www.npmjs.com/package/@wapijs/wapi.js"><img src="https://img.shields.io/npm/v/@wapijs/wapi.js?style=flat-square&label=latest" alt="npm latest" /></a>
  <a href="https://www.npmjs.com/package/@wapijs/wapi.js?activeTab=versions"><img src="https://img.shields.io/npm/v/@wapijs/wapi.js/beta?style=flat-square&label=beta&color=orange" alt="npm beta" /></a>
  <a href="https://github.com/wapikit/wapi.js/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/wapikit/wapi.js/ci.yml?style=flat-square&label=CI" alt="CI" /></a>
  <img src="https://img.shields.io/badge/runtime%20deps-0-brightgreen?style=flat-square" alt="zero runtime dependencies" />
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square" alt="Apache 2.0" /></a>
</p>

**The TypeScript SDK for the WhatsApp Cloud API.**<br />
Send every message type, receive webhooks on any server or runtime, and manage templates, phone numbers and catalogs, with types for all of it.

[Documentation](https://javascript.wapikit.com) · [Migration guide](./MIGRATION.md) · [Examples](./apps) · [Go SDK (wapi.go)](https://github.com/wapikit/wapi.go)

</div>

---

> [!IMPORTANT]
> **wapi.js 0.2 is in beta.** It is a full rewrite that brings wapi.js to parity with [wapi.go](https://github.com/wapikit/wapi.go), the SDK running [WapiKit](https://wapikit.com) in production, and it has **breaking changes**.
>
> ```sh
> npm install @wapijs/wapi.js@beta   # 0.2.0-beta.N
> npm install @wapijs/wapi.js        # 0.1.x, the current stable
> ```
>
> Read the [migration guide](./MIGRATION.md) and the [audit](./OVERHAUL.md) of what changed and why. Please [report anything](https://github.com/wapikit/wapi.js/issues/new/choose) you hit on the beta.

## Why wapi.js

- **Every message type.** Text, media, location, contacts, reactions, reply buttons, lists, CTA URL buttons, location requests, products, product lists, catalogs and templates (header, body and button parameters, named parameters, carousels, limited time offers, copy code and OTP buttons).
- **Webhooks on your stack.** A built-in server for quick starts, or one-line handlers for Express, Fastify, Koa, `node:http`, Next.js, Hono, Bun, Deno, Cloudflare Workers and AWS Lambda.
- **Secure by default.** `X-Hub-Signature-256` verification with a constant time compare, a fail-closed check when the raw body is missing, and no logging of payloads or tokens.
- **Resilient.** A malformed change never fails the whole webhook (so Meta does not re-deliver the batch), a throwing listener never breaks a request, and every Graph API call has a timeout.
- **Typed errors.** Every failed call throws a `GraphApiError` with Meta's code, subcode, details, `fbtrace_id` and an `isRetryable` flag.
- **Multiple numbers.** `client.messaging(phoneNumberId)` sends, replies and manages media for each number of your WABA. Events reply from the number they were received on.
- **Business management.** Templates, phone numbers (registration, verification, QR codes, business profile, usernames), catalogs, analytics and webhook app subscriptions.
- **Identity ready.** Business-scoped user ids (BSUID), parent BSUIDs and usernames on every event, and `send({ to: { userId } })`.
- **Zero runtime dependencies.** ESM and CommonJS builds with full type definitions, Node.js 20+.

## Install

```sh
npm install @wapijs/wapi.js@beta
# or
pnpm add @wapijs/wapi.js@beta
yarn add @wapijs/wapi.js@beta
```

Starting from scratch? `npm create wapi-app` scaffolds a bot.

## Quick start

```ts
import { Client, TextMessage } from "@wapijs/wapi.js";

const client = new Client({
  accessToken: process.env.WHATSAPP_API_ACCESS_TOKEN!,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  webhook: {
    verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN!, // what you typed in the Meta dashboard
    appSecret: process.env.META_APP_SECRET, // App settings → Basic → App secret
  },
});

client.on("TextMessage", async (event) => {
  await event.markAsRead({ typingIndicator: true });
  await event.reply(new TextMessage({ text: `You said: ${event.text}` }));
});

client.on("Error", (error) => console.error(error));

const { port, path } = await client.webhook.listen({ port: 8080, path: "/webhook" });
console.log(`Webhook ready on :${port}${path}`);
```

Then point your Meta app's webhook to `https://<your-domain>/webhook` with the same verify token, and subscribe to the `messages` field. For local development, a tunnel such as `cloudflared tunnel --url http://localhost:8080` gives you a public URL.

## Sending messages

```ts
const { messageId } = await client.message.send({
  to: "15550001111",
  message: new TextMessage({ text: "Your order has shipped 📦", previewUrl: true }),
});
```

- `to` takes a phone number / wa_id, or `{ userId }` for a business-scoped user id.
- `replyToMessageId` quotes a message, `bizOpaqueCallbackData` is echoed back on status events.
- Send from another number with `client.messaging("<phone number id>").message.send(...)`.
- `client.message.sendMarketing(...)` uses the Marketing Messages Lite API.

### Message components

Every component validates WhatsApp's limits when it is built and throws a `ValidationError` before any request is made.

```ts
import {
  TextMessage, ImageMessage, VideoMessage, AudioMessage, DocumentMessage, StickerMessage,
  LocationMessage, LocationRequestMessage, ContactMessage, Contact, ReactionMessage,
  ButtonInteractionMessage, ListInteractionMessage, CtaUrlMessage,
  ProductMessage, ProductListMessage, CatalogMessage,
  TemplateMessage, TemplateParameter, TemplateButton, LanguageEnum,
} from "@wapijs/wapi.js";

new TextMessage({ text: "Hello 👋", previewUrl: true });
new ImageMessage({ link: "https://example.com/menu.png", caption: "Today's menu" });
new DocumentMessage({ id: uploadedMediaId, filename: "invoice.pdf" });
new LocationMessage({ latitude: 12.9716, longitude: 77.5946, name: "Office" });
new LocationRequestMessage({ bodyText: "Share your location so we can find the nearest store" });
new ContactMessage({ contacts: [new Contact({ formattedName: "Jane Doe" }).addPhone({ phone: "+15550001111", type: "WORK" })] });
new ReactionMessage({ messageId: "wamid...", emoji: "🎉" });

new ButtonInteractionMessage({
  header: "Order #1042",
  bodyText: "Confirm your delivery slot",
  footerText: "Reply within 24h",
  buttons: [{ id: "morning", title: "Morning" }, { id: "evening", title: "Evening" }],
});

new ListInteractionMessage({
  bodyText: "What do you need help with?",
  buttonText: "Choose a topic",
  sections: [{ title: "Orders", rows: [{ id: "track", title: "Track my order", description: "Where is my parcel?" }] }],
});

new CtaUrlMessage({ bodyText: "Your invoice is ready", displayText: "Open invoice", url: "https://example.com/i/1042" });

new ProductListMessage({
  catalogId: "1234",
  header: "Summer sale",
  bodyText: "Picked for you",
  sections: [{ title: "Shoes", productRetailerIds: ["sku-1", "sku-2"] }],
});

// Templates: positional or named parameters, media headers, buttons,
// carousels, limited time offers, copy code and OTP buttons
new TemplateMessage({ name: "order_update", language: LanguageEnum.EnglishUS })
  .addHeader(TemplateParameter.image({ link: "https://example.com/parcel.png" }))
  .addBody([TemplateParameter.text("Jane", { name: "first_name" }), TemplateParameter.text("#1042", { name: "order_id" })])
  .addButton(TemplateButton.url({ index: 0, text: "orders/1042" }))
  .addButton(TemplateButton.quickReply({ index: 1, payload: "stop_updates" }));

new TemplateMessage({ name: "login_code", language: "en_US" }).addOtp("482913");
```

## Receiving messages and events

Listeners receive typed event objects and may be `async`.

```ts
client.on("ImageMessage", async (event) => {
  const { data, mimeType } = await event.download();
  await event.react("👀");
});

client.on("ReplyButtonInteraction", (event) => console.log(event.buttonId, event.title));
client.on("ListInteraction", (event) => console.log(event.listId));

client.on("MessageDelivered", (event) => {
  console.log(event.messageId, event.recipientId, event.pricing?.category);
});
client.on("MessageFailed", (event) => console.error(event.messageId, event.error));

client.on("MessageTemplateStatusUpdate", (event) => console.log(event));
```

Every message event carries `messageId`, `from`, `fromUserId`, `senderName`, `username`, `timestamp`, `context` (quoted message, forwarded), `referral` (Click-to-WhatsApp ads), `phoneNumber` and `businessAccountId` of the receiving number, the untouched `raw` payload, and the helpers `reply()`, `send()`, `react()` and `markAsRead()`.

| Group | Events |
|---|---|
| Messages | `TextMessage`, `ImageMessage`, `AudioMessage`, `VideoMessage`, `DocumentMessage`, `StickerMessage`, `LocationMessage`, `ContactsMessage`, `Reaction`, `OrderReceived`, `ProductInquiry`, `AdInteraction`, `UnsupportedMessage` |
| Interactions | `ReplyButtonInteraction`, `ListInteraction`, `QuickReplyButtonInteraction`, `FlowCompletion` |
| Statuses | `MessageStatus` (all), `MessageSent`, `MessageDelivered`, `MessageRead`, `MessageFailed`, `MessageUndelivered` |
| Customers | `CustomerNumberChanged`, `CustomerIdentityChanged`, `UserPreferences`, `UserIdUpdate` |
| Business account | `MessageTemplateStatusUpdate`, `MessageTemplateQualityUpdate`, `MessageTemplateCategoryUpdate`, `MessageTemplateComponentsUpdate`, `PhoneNumberNameUpdate`, `PhoneNumberQualityUpdate`, `AccountUpdate`, `AccountReviewUpdate`, `AccountAlerts`, `BusinessCapabilityUpdate`, `Security`, `PaymentConfigurationUpdate`, `BusinessUsernameUpdate` |
| Coexistence (WhatsApp Business app) | `SmbAppStateSync`, `SmbMessageEchoes`, `History` |
| Client | `Ready`, `Error`, `Warn` |

## Webhooks on your own server

The built-in server is optional. Mount the handler wherever you already serve HTTP:

```ts
// Express: keep the raw body so signatures can be verified
app.use("/webhook", express.raw({ type: "application/json" }), client.webhook.nodeHandler);

// Fastify
app.all("/webhook", (request, reply) => client.webhook.nodeHandler(request.raw, reply.raw));

// Next.js App Router: app/api/webhook/route.ts
export const GET = client.webhook.fetchHandler;
export const POST = client.webhook.fetchHandler;

// Hono, Bun, Deno, Cloudflare Workers
app.all("/webhook", (c) => client.webhook.fetchHandler(c.req.raw, c.executionCtx));

// AWS Lambda (function URL / API Gateway v2) or a queue consumer
const response = await client.webhook.handle({
  method: event.requestContext.http.method,
  query: event.queryStringParameters,
  headers: event.headers,
  rawBody: event.isBase64Encoded ? Buffer.from(event.body, "base64") : event.body,
});
await response.done; // wait for your listeners before the runtime freezes
```

On serverless runtimes pass `waitUntil` (Cloudflare `ctx`, Vercel `waitUntil`) or await `response.done` so listeners finish after the response is sent.

| Request | Response |
|---|---|
| `GET` with `hub.mode=subscribe` and the right token | `200` + `hub.challenge` |
| `GET` with anything else | `403` |
| `POST` with a missing or wrong signature (`appSecret` set) | `401` |
| `POST` with invalid JSON | `400` |
| `POST` accepted | `200`, even if one change or message inside could not be decoded (it is reported through `Error`) |

## Media

```ts
const messaging = client.messaging(); // default phone number
const { id } = await messaging.media.upload({ file: await fs.readFile("menu.pdf"), mimeType: "application/pdf", filename: "menu.pdf" });
await messaging.send({ to, message: new DocumentMessage({ id, filename: "menu.pdf" }) });

const url = await messaging.media.getUrl(mediaId);
const { data, mimeType } = await messaging.media.download(mediaId);
await messaging.media.delete(mediaId);
```

## Business management

These need `businessAccountId` in the client config.

```ts
// Templates
const { data: templates, paging } = await client.templates.list({ status: "APPROVED", limit: 50 });
const all = await client.templates.listAll();
const created = await client.templates.create({
  name: "order_shipped",
  language: "en_US",
  category: "UTILITY",
  components: [{ type: "BODY", text: "Hi {{1}}, your order {{2}} has shipped.", example: { body_text: [["Jane", "#1042"]] } }],
});
await client.templates.delete({ name: "order_shipped" });

// Phone numbers
const numbers = await client.phoneNumbers.list();
await client.phoneNumbers.register(phoneNumberId, "123456");
await client.phoneNumbers.updateBusinessProfile(phoneNumberId, { about: "We reply within an hour" });
const qr = await client.phoneNumbers.createQrCode(phoneNumberId, { prefilledMessage: "Hi!", imageFormat: "PNG" });

// Catalogs
const catalogs = await client.catalogs.list();
const products = await client.catalogs.listAllProducts(catalogs.data[0].id);

// Business account
const account = await client.business.fetch();
await client.business.subscribeApp(); // start receiving webhooks for this WABA
const stats = await client.business.conversationAnalytics({ start, end, granularity: "DAILY" });
```

Every list call takes `{ limit, after, before }` and returns `{ data, paging }`; `iterateAll()` and the `listAll*()` helpers follow the cursors for you.

## Errors

```ts
import { GraphApiError, RequestError, ValidationError } from "@wapijs/wapi.js";

try {
  await client.message.send({ to, message });
} catch (error) {
  if (error instanceof GraphApiError) {
    error.status; // HTTP status
    error.code; // Meta error code, e.g. 131047 (re-engagement window closed)
    error.details; // Meta's explanation
    error.fbtraceId; // quote this to Meta support
    if (error.isRetryable) {
      // 429, 5xx or a throttling code: back off and retry
    }
  } else if (error instanceof RequestError) {
    error.timedOut; // network failure or timeout
  } else if (error instanceof ValidationError) {
    // invalid component input, thrown before any request is made
  }
}
```

## Configuration

| Option | Default | |
|---|---|---|
| `accessToken` | required | System user token with `whatsapp_business_messaging` (and `whatsapp_business_management`) |
| `phoneNumberId` | — | Default number for `client.message` / `client.media` |
| `businessAccountId` | — | Needed for templates, phone numbers, catalogs, business |
| `apiVersion` | `"v20.0"` | Graph API version |
| `graphBaseUrl` | `"https://graph.facebook.com"` | Point at a mock server in tests |
| `fetch` | `globalThis.fetch` | Proxies, instrumentation, tests |
| `timeoutMs` | `60000` | Per request (uploads: 300 000) |
| `logger` | warnings and errors to `console` | Any `{ debug, info, warn, error }`, or `silentLogger` |
| `webhook.verifyToken` | — | Required to receive webhooks |
| `webhook.appSecret` | — | Enables signature verification (recommended) |
| `webhook.port` / `host` / `path` | `8080` / all interfaces / `"/webhook"` | Built-in server only |

`client.setAccessToken(token)` rotates the token at runtime. `client.requester` gives raw, typed access to any Graph endpoint wapi.js does not wrap yet.

## Packages in this repository

| Package | |
|---|---|
| [`@wapijs/wapi.js`](./packages/wapi.js) | The SDK |
| [`create-wapi-app`](./packages/create-wapi-app) | Project scaffolder |
| [`apps/example-chat-bot`](./apps/example-chat-bot) | FAQ bot using lists and replies |
| [`apps/wapi-ai-chatbot`](./apps/wapi-ai-chatbot) | AI chat bot |
| [`apps/docs`](./apps/docs) | Documentation site |

## Release channels

| Channel | Install | Branch |
|---|---|---|
| Stable | `npm i @wapijs/wapi.js` | `master` |
| Beta | `npm i @wapijs/wapi.js@beta` | `beta` |

Releases are automated with semantic-release from [conventional commits](./COMMIT_CONVENTION.md). See [CONTRIBUTING.md](./CONTRIBUTING.md#releases-and-the-beta-channel).

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) first; pull requests for the 0.2 line go to the `beta` branch.

```sh
pnpm install
pnpm build
pnpm test
```

## Maintainer

[Sarthak Jain](https://sarthakjdev.com) · [Twitter](https://twitter.com/sarthakjdev) · [LinkedIn](https://www.linkedin.com/in/sarthakjdev) · sarthak@softlancer.co

## License

[Apache 2.0](./LICENSE).

wapi.js is an independent open source project and is not affiliated with or endorsed by Meta or WhatsApp.
