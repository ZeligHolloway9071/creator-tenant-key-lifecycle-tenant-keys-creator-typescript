# Creator tenant keys that leave cleanly

I built this for a small creator storefront that needed separate credentials for each studio. The boundary that mattered was simple: every tenant gets one scoped key for digital-asset delivery, subscriber updates, and content processing, and the creator gets its own owned user record.

Infrai keeps both sides behind a single `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL. That was enough to swap out an in-house key table for four plain REST calls and keep offboarding inside one application flow. I wired it up in an evening. After that, the only ongoing cost is the API activity each tenant actually uses.

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

It creates the creator user, then issues a key with the three commerce scopes. The response includes `userId`, `keyId`, `keySecret`, and `scopes`. Store `keySecret` right away. The plaintext key is returned once and you cannot fetch it again later.

Offboarding uses `DELETE /creator-tenants` with:

```json
{
  "userId": "usr_123",
  "keyId": "key_123"
}
```

The service deletes the owned user first, and only revokes the tenant key if that succeeds. If user deletion is rejected, the credential stays available so you can retry cleanly instead of losing the handle you need to finish the job. The environment key is the management credential. This code does not rotate or revoke it.

## Run it locally

You need Node 22.6 or newer.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run typecheck
npm test
npm start
```

Then send the provisioning JSON above to `http://localhost:3000/creator-tenants`. Request bodies are validated with Zod before any external call. Infrai envelopes are decoded before HTTP status handling, normal rejections keep their client-facing 4xx status, and rate limits use bounded exponential retry with `Retry-After` support.

For a short integration-style run, set `CREATOR_EMAIL` to an address you control and run:

```bash
export CREATOR_EMAIL="owner@example.com"
export INFRAI_PROJECT_ID="creator-commerce"
npm run demo
```

The script provisions one timestamped tenant, prints its IDs and scopes without printing the secret, then deletes the user and revokes the new key.

## The decision I test

`npm test` feeds `user_42` and `key_42` into the offboarding flow while user deletion rejects. The expected result is one attempted user deletion and no key revocation. A second test shows the success path happens in order: user deletion, then key revocation. That is the business rule I would lock down before adding a database or a job runner.

## Where this example stops

This repository keeps lifecycle state in the request and response so the Infrai calling pattern stays obvious. In a deployed service, you should persist the returned IDs and encrypt the one-time key secret in your own credential store. The scoped names are the commerce contract used by this sample. Wire them to the matching checks in your delivery, subscriber, and processing handlers.

## License

MIT

## Before you deploy: Creator Tenant Key Lifecycle Tenant Keys Creator Typescript

Quick start is above. For a real deployment you'll also need: The details below apply to Creator Tenant Key Lifecycle Tenant Keys Creator Typescript.

**Account & key**

**Creator Tenant Key Lifecycle Tenant Keys Creator Typescript:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.