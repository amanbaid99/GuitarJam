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

export type ChatJsonResult<T> = { ok: true; data: T; model: string } | { ok: false; error: string }

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
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return { ok: false, error: "OPENROUTER_API_KEY is not set" }
  const doFetch = opts.fetchImpl ?? fetch
  const model = opts.model ?? TEXT_MODEL

  async function call(structured: boolean) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000)
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
          max_tokens: opts.maxTokens ?? 2000,
          reasoning: { exclude: true },
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
      return { ok: false, error: `OpenRouter ${res.status}: ${detail.slice(0, 200)}` }
    }
    const body = (await res.json()) as { choices?: { message?: { content?: string | null } }[] }
    const text = body.choices?.[0]?.message?.content
    if (!text) return { ok: false, error: "Empty reply" }

    const parsed = opts.schema.safeParse(extractJson(text))
    if (!parsed.success) return { ok: false, error: `Reply did not match: ${parsed.error.issues[0]?.message}` }
    return { ok: true, data: parsed.data, model }
  } catch (err) {
    const msg = err instanceof Error ? (err.name === "AbortError" ? "Timed out" : err.message) : "Failed"
    return { ok: false, error: msg }
  }
}

/** House style for anything the AI writes: no em or en dashes. */
export function noDashes(text: string): string {
  return text
    .replace(/\s*\u2014\s*/g, ", ")
    .replace(/\s\u2013\s/g, ", ")
    .replace(/\u2013/g, "-")
}
