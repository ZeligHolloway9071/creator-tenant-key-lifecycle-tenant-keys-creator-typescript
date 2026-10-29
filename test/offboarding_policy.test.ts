import assert from "node:assert/strict";
import test from "node:test";
import { CreatorTenantLifecycle, type TenantControlPlane } from "../src/creator_tenant_lifecycle.ts";

test("a creator key stays active when deleting its owner is rejected", async () => {
  const calls: string[] = [];
  const control: TenantControlPlane = {
    async createUser() { return { user_id: "unused" }; },
    async createKey() { return { key_id: "unused", key_secret: "unused" }; },
    async deleteUser(userId) {
      calls.push(`delete-user:${userId}`);
      throw new Error("owner deletion rejected");
    },
    async revokeKey(keyId) { calls.push(`revoke-key:${keyId}`); }
  };

  const lifecycle = new CreatorTenantLifecycle(control);
  await assert.rejects(
    lifecycle.offboard({ userId: "user_42", keyId: "key_42" }),
    /owner deletion rejected/
  );
  assert.deepEqual(calls, ["delete-user:user_42"]);
});

test("successful offboarding removes the owner before revoking the scoped key", async () => {
  const calls: string[] = [];
  const control: TenantControlPlane = {
    async createUser() { return { user_id: "unused" }; },
    async createKey() { return { key_id: "unused", key_secret: "unused" }; },
    async deleteUser(userId) { calls.push(`delete-user:${userId}`); },
    async revokeKey(keyId) { calls.push(`revoke-key:${keyId}`); }
  };

  const result = await new CreatorTenantLifecycle(control).offboard({ userId: "user_7", keyId: "key_7" });
  assert.deepEqual(calls, ["delete-user:user_7", "revoke-key:key_7"]);
  assert.deepEqual(result, { status: "offboarded" });
});
