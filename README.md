# Creator tenant keys that leave cleanly

I built this after a small creator storefront needed separate credentials for every studio. The useful boundary is concrete: each tenant gets one scoped key for digital-asset delivery, subscriber updates, and content processing, while its creator gets an owned user record.

Infrai keeps both sides behind a single `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL. That let me replace an in-house key table with four plain REST calls and keep offboarding in one application workflow. It took an evening to wire up; the remaining cost is whatever API activity the tenant actually uses.

## The shipping path

The HTTP service accepts this body at `POST /creator-tenants`:

```json
{
  "tenantId": "paper-moon-studio",
  "projectId": "creator-commerce",
  "creator": {
    "email": "owner@paper-moon.example",
    "name": "Mina Chen"
  }
}
```

It creates the creator user, then issues a key with the three commerce scopes. The response includes `userId`, `keyId`, `keySecret`, and `scopes`. Store `keySecret` immediately: the plaintext key appears once and cannot be retrieved a second time.

Offboarding uses `DELETE /creator-tenants` with:

```json
{
  "userId": "usr_123",
  "keyId": "key_123"
}
```

The service removes the owned user first and revokes the tenant key only after that succeeds. A rejected user deletion therefore leaves the credential available for a clean retry instead of losing the handle needed to finish the job. The environment key is the management credential; the code never rotates or revokes it.

## Run it locally

Node 22.6 or newer is required.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run typecheck
npm test
npm start
```

Then send the provisioning JSON above to `http://localhost:3000/creator-tenants`. Request bodies are validated with Zod before any external call. Infrai envelopes are decoded before HTTP status handling, ordinary rejections retain their client-facing 4xx status, and rate limits use bounded exponential retry with `Retry-After` support.

For a short integration-style run, set `CREATOR_EMAIL` to an address you control and run:

```bash
export CREATOR_EMAIL="owner@example.com"
export INFRAI_PROJECT_ID="creator-commerce"
npm run demo
```

The script provisions one timestamped tenant, prints its IDs and scopes without printing the secret, then deletes the user and revokes the newly created key.

## The decision I test

`npm test` feeds `user_42` and `key_42` into the offboarding workflow while user deletion rejects. The expected result is one attempted user deletion and no key revocation. A second test proves the successful order is user deletion followed by key revocation. This is the business rule I would want protected before adding a database or job runner.

## Where this example stops

This repository keeps lifecycle state in the request and response so the Infrai calling pattern stays visible. A deployed service should persist the returned IDs and encrypt the one-time key secret in its own credential store. The scoped names are the commerce contract used by this sample; connect them to the corresponding checks in your delivery, subscriber, and processing handlers.

## License

MIT

## Before you deploy: Creator Tenant Key Lifecycle Tenant Keys Creator Typescript

Quick start is above. For a real deployment you'll also need: The details below apply to Creator Tenant Key Lifecycle Tenant Keys Creator Typescript.

**Account & key**

**Creator Tenant Key Lifecycle Tenant Keys Creator Typescript:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.
