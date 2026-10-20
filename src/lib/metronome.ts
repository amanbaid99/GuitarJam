export const MIN_BPM = 40
export const MAX_BPM = 220

export const clampBpm = (bpm: number) => Math.round(Math.min(MAX_BPM, Math.max(MIN_BPM, bpm)))

/**
 * Tap tempo: BPM from recent tap times (ms). Uses the last 4 gaps.
 * A pause of over 2 seconds starts a fresh count. Needs 2+ taps.
 */
export function bpmFromTaps(taps: number[]): number | null {
  const recent: number[] = []
  for (let i = taps.length - 1; i > 0; i--) {
    const gap = taps[i] - taps[i - 1]
    if (gap > 2000 || gap <= 0) break
    recent.push(gap)
    if (recent.length === 4) break
  }
  if (recent.length === 0) return null
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length
  return clampBpm(60000 / avg)
}

/**
 * Click scheduler on the Web Audio clock (the "look ahead" pattern):
 * a timer wakes every 25 ms and queues any clicks due in the next 100 ms
 * at exact audio times, so timing stays steady even if the page is busy.
 */
export class Metronome {
  private ctx: AudioContext | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private nextTime = 0
  private beat = 0

  bpm = 80
  beatsPerBar = 4
  accent = true
  /** Called close to when each beat sounds, with its index in the bar. */
  onBeat: ((beat: number) => void) | null = null

  get running() {
    return this.timer !== null
  }

  async start() {
    if (this.running) return
    // Must be created/resumed inside a tap for mobile browsers to allow sound.
    this.ctx ??= new AudioContext()
    if (this.ctx.state !== "running") await this.ctx.resume()
    this.beat = 0
    this.nextTime = this.ctx.currentTime + 0.06
    this.timer = setInterval(() => this.schedule(), 25)
    this.schedule()
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async close() {
    this.stop()
    await this.ctx?.close().catch(() => {})
    this.ctx = null
  }

  private schedule() {
    const ctx = this.ctx
    if (!ctx) return
    while (this.nextTime < ctx.currentTime + 0.1) {
      this.click(this.nextTime, this.accent && this.beat === 0)
      const beat = this.beat
      const delayMs = Math.max(0, (this.nextTime - ctx.currentTime) * 1000)
      setTimeout(() => this.onBeat?.(beat), delayMs)
      this.nextTime += 60 / this.bpm
      this.beat = (this.beat + 1) % this.beatsPerBar
    }
  }

  private click(at: number, strong: boolean) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = strong ? 1600 : 1000
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(strong ? 0.9 : 0.5, at + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05)
    osc.connect(gain).connect(ctx.destination)
    osc.start(at)
    osc.stop(at + 0.06)
  }
}
