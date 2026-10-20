import "server-only"
import type { z } from "zod"

/**
 * OpenRouter chat completions, server only. The API key never reaches the browser.
 * Defaults to NVIDIA's free Nemotron models; override with env vars.
 */
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
export const TEXT_MODEL = process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-super-120b-a12b:free"
export const VISION_MODEL = process.env.OPENROUTER_VISION_MODEL || "nvidia/nemotron-3.5-super-vl:free"

export const aiConfigured = () => Boolean(process.env.OPENROUTER_API_KEY)

type Content = string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[]

export type ChatJsonOptions<T> = {
  system: string
  user: Content
  /** Validates the model's answer. Anything that fails is rejected. */
  schema: z.ZodType<T>
  /** Strict JSON schema sent to the model (every field required, no extras). */
  jsonSchema: { name: string; schema: Record<string, unknown> }
  model?: string
  timeoutMs?: number
  temperature?: number
  maxTokens?: number
  /** For tests. */
  fetchImpl?: typeof fetch
}

/** Why an AI call failed, in words the app can show. */
export type AiFailure =
  | "no_key"
  | "bad_key"
  | "privacy"
  | "credits"
  | "rate_limit"
  | "timeout"
  | "unavailable"
  | "empty"
  | "bad_reply"
  | "network"

export const AI_FAILURE_MESSAGE: Record<AiFailure, string> = {
  no_key: "AI is not set up: OPENROUTER_API_KEY is missing on the server (add it in Vercel, then redeploy).",
  bad_key: "OpenRouter rejected the API key. Check OPENROUTER_API_KEY in Vercel, then redeploy.",
  privacy: "OpenRouter blocked the free model. Allow free models at openrouter.ai/settings/privacy.",
  credits: "OpenRouter says this needs credits. Check the model is a :free one.",
  rate_limit: "Free AI limit reached for now. Try again in a bit.",
  timeout: "The AI took too long to answer. Try again.",
  unavailable: "The free AI model is unavailable right now. Try again later.",
  empty: "The AI sent back an empty answer. Try again.",
  bad_reply: "The AI answer was not usable. Try again.",
  network: "Could not reach OpenRouter.",
}

export type ChatJsonResult<T> =
  | { ok: true; data: T; model: string }
  | { ok: false; reason: AiFailure; error: string }

/** Maps an OpenRouter error response to a reason. */
export function classifyFailure(status: number, body: string): AiFailure {
  const text = body.toLowerCase()
  if (status === 401 || status === 403) return /privacy|data policy/.test(text) ? "privacy" : "bad_key"
  if (status === 402) return "credits"
  if (status === 404 && /data policy|privacy|no endpoints/.test(text)) return "privacy"
  if (status === 429) return "rate_limit"
  if (status === 408 || status === 504) return "timeout"
  return "unavailable"
}

/** Pulls a JSON object out of a reply, tolerating ```json fences or stray text around it. */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf("{")
  const end = body.lastIndexOf("}")
  if (start < 0 || end <= start) throw new Error("No JSON object in reply")
  return JSON.parse(body.slice(start, end + 1))
}

export async function chatJson<T>(opts: ChatJsonOptions<T>): Promise<ChatJsonResult<T>> {
  const model = opts.model ?? TEXT_MODEL
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return fail("no_key", "OPENROUTER_API_KEY is not set")
  const doFetch = opts.fetchImpl ?? fetch

  async function call(structured: boolean) {
    const controller = new AbortController()
    // Free reasoning models can be slow; give them room (pages set maxDuration to match).
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 75_000)
    try {
      const res = await doFetch(ENDPOINT, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "X-Title": "My Jamm",
        },
        body: JSON.stringify({
          model,
          temperature: opts.temperature ?? 0.4,
          // Reasoning tokens count toward max_tokens, so leave plenty of room for the answer.
          max_tokens: opts.maxTokens ?? 8000,
          reasoning: { effort: "low", exclude: true },
          messages: [
            { role: "system", content: opts.system },
            { role: "user", content: opts.user },
          ],
          ...(structured
            ? {
                response_format: {
                  type: "json_schema",
                  json_schema: { name: opts.jsonSchema.name, strict: true, schema: opts.jsonSchema.schema },
                },
              }
            : {}),
        }),
      })
      return res
    } finally {
      clearTimeout(timer)
    }
  }

  try {
    let res = await call(true)
    // Some free endpoints reject structured output; ask again with the schema in the prompt only.
    if (res.status === 400) res = await call(false)
    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      return fail(classifyFailure(res.status, detail), `OpenRouter ${res.status}: ${detail.slice(0, 300)}`)
    }
    const body = (await res.json()) as {
      error?: { code?: number; message?: string }
      choices?: { finish_reason?: string; message?: { content?: string | { type: string; text?: string }[] | null } }[]
    }
    // OpenRouter can return 200 with an error object from the upstream provider.
    if (body.error) {
      return fail(classifyFailure(body.error.code ?? 502, body.error.message ?? ""), `Upstream: ${body.error.message ?? "error"}`)
    }
    const raw = body.choices?.[0]?.message?.content
    const text = Array.isArray(raw) ? raw.map((p) => p.text ?? "").join("") : raw
    if (!text) return fail("empty", `Empty reply (finish: ${body.choices?.[0]?.finish_reason ?? "?"})`)

    let json: unknown
    try {
      json = extractJson(text)
    } catch {
      return fail("bad_reply", `Not JSON: ${text.slice(0, 200)}`)
    }
    const parsed = opts.schema.safeParse(json)
    if (!parsed.success) return fail("bad_reply", `Reply did not match: ${parsed.error.issues[0]?.message}`)
    return { ok: true, data: parsed.data, model }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return fail("timeout", "Timed out")
    return fail("network", err instanceof Error ? err.message : "Failed")
  }

  function fail(reason: AiFailure, error: string): ChatJsonResult<T> {
    // Visible in Vercel > Logs, never shown in full to the browser.
    console.error(`[ai] ${model}: ${reason}: ${error}`)
    return { ok: false, reason, error }
  }
}

/** House style for anything the AI writes: no em or en dashes. */
export function noDashes(text: string): string {
  return text
    .replace(/\s*\u2014\s*/g, ", ")
    .replace(/\s\u2013\s/g, ", ")
    .replace(/\u2013/g, "-")
}
