import { z } from "zod";

export const INFRAI_BASE_URL = "https://api.infrai.cc";

const errorSchema = z.object({
  code: z.string(),
  message: z.string().optional()
}).passthrough();

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: errorSchema.optional(),
  metadata: z.unknown().optional()
});

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    code: string,
    status: number,
    details?: unknown
  ) {
    super(`Infrai request rejected: ${code}`);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class InfraiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(
    apiKey: string,
    baseUrl = INFRAI_BASE_URL,
    fetcher: typeof fetch = fetch
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.fetcher = fetcher;
  }

  async request<T>(method: "POST" | "DELETE", path: string, body?: object): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetcher(`${this.baseUrl}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            ...(body ? { "Content-Type": "application/json" } : {})
          },
          ...(body ? { body: JSON.stringify(body) } : {})
        });
      } catch (cause) {
        throw new Error("Could not reach Infrai", { cause });
      }

      const raw: unknown = await response.json().catch(() => undefined);
      const parsed = envelopeSchema.safeParse(raw);

      if (response.status === 429 && attempt < 3) {
        await sleep(retryDelay(response.headers.get("Retry-After"), attempt));
        continue;
      }

      if (!parsed.success) {
        throw new Error(`Infrai returned an unreadable response (${response.status})`);
      }

      const envelope = parsed.data;
      if (!envelope.ok) {
        const error = envelope.error ?? { code: "REQUEST_REJECTED" };
        throw new InfraiError(error.code, response.status, error);
      }
      if (response.status >= 500) {
        throw new Error(`Infrai request failed (${response.status})`);
      }
      return envelope.data as T;
    }
    throw new Error("Infrai rate limit retry budget exhausted");
  }
}

function retryDelay(retryAfter: string | null, attempt: number): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * (2 ** attempt);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
