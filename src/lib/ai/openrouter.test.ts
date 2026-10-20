import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { chatJson } from "./openrouter"

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "test-key"
})

describe("chatJson", () => {
  it("reports the model that actually answered after a fallback", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ model: "google/gemma-4-31b-it:free", choices: [{ message: { content: '{"ok":true}' } }] })),
    )
    const res = await chatJson({
      system: "s",
      user: "u",
      schema: z.object({ ok: z.boolean() }),
      jsonSchema: { name: "t", schema: {} },
      fetchImpl,
    })
    expect(res).toEqual({ ok: true, data: { ok: true }, model: "google/gemma-4-31b-it:free" })
  })
})
