import { CreatorTenantLifecycle, InfraiTenantControlPlane } from "./creator_tenant_lifecycle.ts";
import { InfraiClient } from "./infrai_client.ts";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the demo");

const lifecycle = new CreatorTenantLifecycle(new InfraiTenantControlPlane(new InfraiClient(apiKey)));
const tenantId = `studio-${Date.now()}`;
const access = await lifecycle.provision({
  tenantId,
  projectId: process.env.INFRAI_PROJECT_ID ?? "creator-commerce",
  creator: {
    email: process.env.CREATOR_EMAIL ?? "creator@example.com",
    name: "Demo Creator"
  }
});

console.log(JSON.stringify({
  tenantId: access.tenantId,
  userId: access.userId,
  keyId: access.keyId,
  scopes: access.scopes,
  note: "Store keySecret now; the plaintext credential cannot be retrieved again."
}, null, 2));

await lifecycle.offboard({ userId: access.userId, keyId: access.keyId });
console.log(JSON.stringify({ tenantId, status: "offboarded" }, null, 2));
