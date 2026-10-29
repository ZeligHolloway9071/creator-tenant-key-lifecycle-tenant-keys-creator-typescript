import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import { CreatorTenantLifecycle, InfraiTenantControlPlane, creatorOffboardingSchema, creatorTenantSchema } from "./creator_tenant_lifecycle.ts";
import { InfraiClient, InfraiError } from "./infrai_client.ts";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const lifecycle = new CreatorTenantLifecycle(new InfraiTenantControlPlane(new InfraiClient(apiKey)));
const port = Number(process.env.PORT ?? 3000);

createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/creator-tenants") {
      const input = creatorTenantSchema.parse(await readJson(request));
      const access = await lifecycle.provision(input);
      sendJson(response, 201, access);
      return;
    }
    if (request.method === "DELETE" && request.url === "/creator-tenants") {
      const input = creatorOffboardingSchema.parse(await readJson(request));
      sendJson(response, 200, await lifecycle.offboard(input));
      return;
    }
    sendJson(response, 404, { error: "route_not_found" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendJson(response, 400, { error: "invalid_request", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      sendJson(response, status, { error: error.code });
      return;
    }
    console.error(error);
    sendJson(response, 502, { error: "upstream_request_failed" });
  }
}).listen(port, () => console.log(`Creator tenant service listening on http://localhost:${port}`));

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}
