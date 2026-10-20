"use server"

import { z } from "zod"
import { AI_FAILURE_MESSAGE, TEXT_MODELS, VISION_MODELS, chatJson } from "@/lib/ai/openrouter"
import { requireUser } from "@/lib/auth"

export type AiTestResult =
  | { ok: true; model: string; ms: number }
  | { ok: false; message: string; detail: string; model: string }

/** Sends one tiny request to OpenRouter and reports exactly what happened. */
export async function testAi(kind: "text" | "vision" = "text"): Promise<AiTestResult> {
  await requireUser()
  const models = kind === "vision" ? VISION_MODELS : TEXT_MODELS
  const started = Date.now()
  const res = await chatJson({
    models,
    system: 'You are a health check. Reply with JSON only: {"ok": true}.',
    user: "Health check.",
    schema: z.object({ ok: z.boolean() }),
    jsonSchema: {
      name: "health_check",
      schema: {
        type: "object",
        properties: { ok: { type: "boolean" } },
        required: ["ok"],
        additionalProperties: false,
      },
    },
    maxTokens: 2000,
  })
  if (res.ok) return { ok: true, model: res.model, ms: Date.now() - started }
  // The detail never includes the key; it is OpenRouter's own error text.
  return { ok: false, message: AI_FAILURE_MESSAGE[res.reason], detail: res.error.slice(0, 300), model: models.join(", ") }
}
