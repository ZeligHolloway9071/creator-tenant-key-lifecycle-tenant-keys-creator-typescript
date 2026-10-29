import { createHash } from "node:crypto";
import { z } from "zod";
import { InfraiClient } from "./infrai_client.ts";

export const creatorTenantSchema = z.object({
  tenantId: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  projectId: z.string().min(1),
  creator: z.object({
    email: z.string().email(),
    name: z.string().min(1).max(100)
  })
});

export const creatorOffboardingSchema = z.object({
  userId: z.string().min(1),
  keyId: z.string().min(1)
});

export type CreatorTenant = z.infer<typeof creatorTenantSchema>;
export type CreatorOffboarding = z.infer<typeof creatorOffboardingSchema>;

type CreatedUser = { user_id: string };
type CreatedKey = { key_id: string; key_secret: string };

export type CreatorAccess = {
  tenantId: string;
  userId: string;
  keyId: string;
  keySecret: string;
  scopes: readonly string[];
};

export interface TenantControlPlane {
  createUser(input: CreatorTenant, idempotencyKey: string): Promise<CreatedUser>;
  deleteUser(userId: string): Promise<void>;
  createKey(input: CreatorTenant, scopes: readonly string[], idempotencyKey: string): Promise<CreatedKey>;
  revokeKey(keyId: string): Promise<void>;
}

export const CREATOR_SCOPES = [
  "digital_asset_delivery",
  "subscriber_updates",
  "content_processing"
] as const;

export class CreatorTenantLifecycle {
  private readonly control: TenantControlPlane;

  constructor(control: TenantControlPlane) {
    this.control = control;
  }

  async provision(input: CreatorTenant): Promise<CreatorAccess> {
    const user = await this.control.createUser(input, operationId(input.tenantId, "user"));
    try {
      const key = await this.control.createKey(input, CREATOR_SCOPES, operationId(input.tenantId, "key"));
      return {
        tenantId: input.tenantId,
        userId: user.user_id,
        keyId: key.key_id,
        keySecret: key.key_secret,
        scopes: CREATOR_SCOPES
      };
    } catch (cause) {
      await this.control.deleteUser(user.user_id);
      throw cause;
    }
  }

  async offboard(input: CreatorOffboarding): Promise<{ status: "offboarded" }> {
    // Keep the tenant credential active unless its owner was removed successfully.
    await this.control.deleteUser(input.userId);
    await this.control.revokeKey(input.keyId);
    return { status: "offboarded" };
  }
}

export class InfraiTenantControlPlane implements TenantControlPlane {
  private readonly client: InfraiClient;

  constructor(client: InfraiClient) {
    this.client = client;
  }

  createUser(input: CreatorTenant, idempotencyKey: string): Promise<CreatedUser> {
    return this.client.request("POST", "/v1/auth/user/create", {
      email: input.creator.email,
      name: input.creator.name,
      metadata: { tenant_id: input.tenantId },
      mode: "default_vendor",
      idempotency_key: idempotencyKey
    });
  }

  async deleteUser(userId: string): Promise<void> {
    await this.client.request("DELETE", `/v1/auth/user/delete/${encodeURIComponent(userId)}`);
  }

  createKey(input: CreatorTenant, scopes: readonly string[], idempotencyKey: string): Promise<CreatedKey> {
    return this.client.request("POST", "/v1/account/keys/create", {
      project_id: input.projectId,
      name: `creator-${input.tenantId}`,
      scopes,
      idempotency_key: idempotencyKey
    });
  }

  async revokeKey(keyId: string): Promise<void> {
    await this.client.request("DELETE", `/v1/account/keys/revoke/${encodeURIComponent(keyId)}`);
  }
}

function operationId(tenantId: string, operation: "user" | "key"): string {
  return createHash("sha256").update(`creator-tenant:${tenantId}:${operation}`).digest("hex");
}
