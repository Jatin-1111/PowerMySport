# PhonePe Webhook - Setup & Smoke Tests

This document explains how to register and test the PhonePe webhook endpoint implemented at `/api/payments/phonepe/webhook`.

Endpoint (deployed):

https://api.powermysport.com/api/payments/phonepe/webhook

Local testing (ngrok):

1. Install and run ngrok (or similar tunnelling tool):

```bash
ngrok http 5000
```

2. Copy the HTTPS forwarding URL from ngrok (for example `https://abcd1234.ngrok.io`) and register the webhook URL in PhonePe dashboard as:

```
https://abcd1234.ngrok.io/api/payments/phonepe/webhook
```

PhonePe webhook secret:

- Set the secret in your server environment as `PHONEPE_WEBHOOK_SECRET`. Example `.env` entry (do NOT commit):

```
PHONEPE_WEBHOOK_SECRET=the_secret_phonepe_provided
```

Signature header:

- PhonePe should include an HMAC SHA256 signature of the raw request body (hex). The route checks `x-phonepe-signature` and `x-callback-signature` headers.

How to craft a signed test request locally:

1. Create a JSON payload file `payload.json`:

```json
{
  "event": "pg.order.completed",
  "data": { "transactionId": "txn_test_123", "amount": 1000 },
  "eventId": "txn_test_123"
}
```

2. Compute HMAC SHA256 hex (example, Bash):

```bash
SECRET="the_secret_phonepe_provided"
BODY=$(cat payload.json)
SIGNATURE=$(printf "%s" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')

curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-phonepe-signature: $SIGNATURE" \
  --data-binary @payload.json \
  https://abcd1234.ngrok.io/api/payments/phonepe/webhook
```

3. Example Node.js script to send a signed request:

```js
const crypto = require("crypto");
const fs = require("fs");
const fetch = require("node-fetch");

const secret =
  process.env.PHONEPE_WEBHOOK_SECRET || "the_secret_phonepe_provided";
const body = fs.readFileSync("./payload.json");
const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");

fetch("https://abcd1234.ngrok.io/api/payments/phonepe/webhook", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-phonepe-signature": sig },
  body,
})
  .then((r) => r.text())
  .then(console.log)
  .catch(console.error);
```

What the server does on receipt:

- Verifies HMAC using `PHONEPE_WEBHOOK_SECRET` against the raw request body. If invalid, responds `401`.
- Persists an idempotent `PaymentWebhookEvent` (unique `eventId`).
- Enqueues an `OutboxMessage` job of type `process_payment_webhook` for async processing.

Recommended PhonePe events to subscribe to:

- `pg.order.completed` / `checkout.order.completed` (payment success)
- `pg.refund.completed`, `pg.refund.failed`
- `settlement.processed` (if you care about settlements)
- `payment.dispute.*` events (optional)
- Subscription lifecycle events if using subscriptions

Notes & troubleshooting:

- Ensure the webhook URL is reachable from PhonePe; use ngrok for local dev.
- Make sure the `Content-Type` is `application/json` and the signature is computed over the exact raw body bytes. The server relies on `express.json` verify to capture the raw body.
- Check logs for `PHONEPE_WEBHOOK_SECRET not configured` or signature mismatch messages.
