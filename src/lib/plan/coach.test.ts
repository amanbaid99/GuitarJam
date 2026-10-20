import { beforeEach, describe, expect, it, vi } from "vitest"
import { extractJson } from "@/lib/ai/openrouter"
import { buildUserMessage, cleanAiPlan, coachPlan, type CoachInput } from "./coach"
import { planTotal } from "./types"

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

const input: CoachInput = {
  minutes: 20,
  today: "2026-10-20",
  focusSkill: "Strumming with a metronome",
  songs: [
    { id: id(1), title: "Yellow", status: "learning", family_id: "f1", last_practised: null },
    { id: id(2), title: "Perfect", status: "can_play", family_id: "f1", last_practised: "2026-09-01" },
    { id: id(3), title: "Stay", status: "want_to_learn", family_id: null, last_practised: null },
  ],
  recentSessionDates: ["2026-10-14", "2026-10-18"],
  skills: [{ area: "rhythm", name: "Strumming with a metronome", level: "learning", is_focus: true }],
  familyNames: { f1: "G-Em-C-D" },
  recentSessions: [],
}

const reply = (content: string, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status }))

const goodPlan = {
  blocks: [
    { label: "Warm-up", minutes: 3, instruction: "G (320003) to C (x32010).", song_id: null },
    { label: "Metronome", minutes: 6, instruction: "70 BPM, D DU UDU.", song_id: null },
    { label: "Yellow", minutes: 7, instruction: "Full run with capo 4.", song_id: id(1) },
    { label: "Free play", minutes: 4, instruction: "Perfect from memory.", song_id: id(2) },
  ],
  why: "Short and focused.",
}

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "test-key"
})

describe("coachPlan", () => {
  it("uses a valid AI plan", async () => {
    const fetchImpl = reply(JSON.stringify(goodPlan))
    const res = await coachPlan(input, fetchImpl)
    expect(res.source).toBe("ai")
    expect(planTotal(res.plan)).toBe(20)
    expect(res.plan.blocks[2].song_id).toBe(id(1))
    expect(res.plan.blocks[0]).not.toHaveProperty("song_id")

    // Sent to OpenRouter with the key, the free Nemotron model and a strict schema.
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions")
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key")
    const body = JSON.parse(String(init.body))
    expect(body.model).toMatch(/nemotron.*:free/)
    expect(body.response_format.json_schema.strict).toBe(true)
  })

  it("reads JSON wrapped in a code fence", async () => {
    const res = await coachPlan(input, reply("Here you go:\n```json\n" + JSON.stringify(goodPlan) + "\n```"))
    expect(res.source).toBe("ai")
  })

  it("drops song ids that are not yours", async () => {
    const plan = { ...goodPlan, blocks: goodPlan.blocks.map((b) => ({ ...b, song_id: b.song_id ? id(99) : null })) }
    const res = await coachPlan(input, reply(JSON.stringify(plan)))
    expect(res.plan.blocks.some((b) => b.song_id)).toBe(false)
  })

  it("removes em dashes from AI text", async () => {
    const plan = { ...goodPlan, why: "Keep it light \u2014 you are restarting." }
    const res = await coachPlan(input, reply(JSON.stringify(plan)))
    expect(res.plan.why).toBe("Keep it light, you are restarting.")
  })

  it("retries without structured output when the model rejects it", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("structured outputs not supported", { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(goodPlan) } }] })))
    const res = await coachPlan(input, fetchImpl)
    expect(res.source).toBe("ai")
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1].body)).response_format).toBeUndefined()
  })

  it("falls back to the built-in plan when the AI is down", async () => {
    const res = await coachPlan(input, reply("upstream down", 503))
    expect(res.source).toBe("template")
    expect(res.note).toMatch(/unavailable/)
    expect(planTotal(res.plan)).toBe(20)
  })

  it("falls back when no key is set", async () => {
    delete process.env.OPENROUTER_API_KEY
    const fetchImpl = vi.fn()
    const res = await coachPlan(input, fetchImpl)
    expect(res.source).toBe("template")
    expect(res.note).toMatch(/OPENROUTER_API_KEY is missing/)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("falls back on garbage", async () => {
    const res = await coachPlan(input, reply("I think you should practise a lot!"))
    expect(res.source).toBe("template")
  })
})

describe("cleanAiPlan", () => {
  it("fixes a small total miss on the longest block", () => {
    const raw = { ...goodPlan, blocks: goodPlan.blocks.map((b, i) => (i === 2 ? { ...b, minutes: 9 } : b)) }
    const plan = cleanAiPlan(raw, input)!
    expect(planTotal(plan)).toBe(20)
    expect(plan.blocks[2].minutes).toBe(7)
  })

  it("rejects a plan that is way off", () => {
    const raw = { ...goodPlan, blocks: goodPlan.blocks.map((b) => ({ ...b, minutes: 10 })) }
    expect(cleanAiPlan(raw, input)).toBeNull()
  })
})

describe("buildUserMessage", () => {
  it("leaves out want-to-learn songs and sends days since played", () => {
    const msg = JSON.parse(buildUserMessage(input))
    expect(msg.songs.map((s: { title: string }) => s.title)).toEqual(["Yellow", "Perfect"])
    expect(msg.songs[1]).toMatchObject({ family: "G-Em-C-D", days_since_played: 49 })
  })
})

describe("extractJson", () => {
  it("finds the object inside chatter", () => {
    expect(extractJson('Sure! {"a": 1} Hope that helps')).toEqual({ a: 1 })
  })
  it("throws when there is none", () => {
    expect(() => extractJson("nope")).toThrow()
  })
})

describe("failure reasons", () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key"
  })
  const status = (code: number, body: string) => vi.fn(async () => new Response(body, { status: code }))

  it.each([
    [401, '{"error":{"message":"No auth credentials found"}}', /rejected the API key/],
    [404, '{"error":{"message":"No endpoints found matching your data policy"}}', /settings\/privacy/],
    [429, '{"error":{"message":"Rate limit exceeded: free-models-per-day"}}', /limit reached/],
    [402, '{"error":{"message":"Insufficient credits"}}', /credits/],
  ])("explains HTTP %i clearly", async (code, body, message) => {
    const res = await coachPlan(input, status(code, body))
    expect(res.source).toBe("template")
    expect(res.note).toMatch(message)
  })

  it("explains an empty answer (reasoning used up the tokens)", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "" } }] })),
    )
    expect((await coachPlan(input, fetchImpl)).note).toMatch(/empty answer/)
  })

  it("explains an error sent inside a 200 reply", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: { code: 429, message: "upstream rate limit" } })))
    expect((await coachPlan(input, fetchImpl)).note).toMatch(/limit reached/)
  })

  it("asks for low reasoning effort and room for the answer", async () => {
    const fetchImpl = reply(JSON.stringify(goodPlan))
    await coachPlan(input, fetchImpl)
    const body = JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(body.reasoning).toEqual({ effort: "low", exclude: true })
    expect(body.max_tokens).toBeGreaterThanOrEqual(8000)
  })
})

describe("model chain", () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key"
  })

  it("sends a chain of free models so OpenRouter can fall back", async () => {
    const fetchImpl = reply(JSON.stringify(goodPlan))
    await coachPlan(input, fetchImpl)
    const body = JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(body.models.length).toBeGreaterThanOrEqual(2)
    expect(body.models.every((m: string) => m.endsWith(":free"))).toBe(true)
    expect(body.model).toBe(body.models[0])
  })

  it("treats NVIDIA's 'function not found' as the model being unavailable", async () => {
    const nvidia404 = JSON.stringify({
      error: {
        message: "Provider returned error",
        code: 404,
        metadata: { raw: '{"status":404,"title":"Not Found","detail":"Function abc: Not found for account xyz"}', provider_name: "Nvidia" },
      },
    })
    const res = await coachPlan(input, vi.fn(async () => new Response(nvidia404, { status: 404 })))
    expect(res.source).toBe("template")
    expect(res.note).toMatch(/unavailable/)
  })
})
