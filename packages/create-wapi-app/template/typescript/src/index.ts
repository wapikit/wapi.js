import "dotenv/config";
import { TextMessage } from "@wapijs/wapi.js";
import { client } from "./utils/client.js";

client.on("Ready", ({ port, path }) => {
  console.log(`Webhook listening on http://localhost:${port}${path}`);
});

client.on("Error", (error) => {
  console.error("wapi.js error:", error);
});

client.on("TextMessage", async (event) => {
  await event.markAsRead({ typingIndicator: true });
  await event.reply(
    new TextMessage({
      text: `Hello ${event.senderName ?? "there"}! You said: ${event.text}`,
    }),
  );
});

await client.webhook.listen();

process.on("SIGINT", () => {
  void client.close().then(() => process.exit(0));
});
