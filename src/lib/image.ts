"use client"

/** Readable width for chord charts. Wider phone screenshots are scaled down to this. */
export const SLICE_WIDTH = 1100
/** Tallest piece sent to the AI; vision models read text badly in very tall images. */
export const SLICE_HEIGHT = 1600
/** Pieces overlap so a line cut at the edge is whole in the next piece. */
export const SLICE_OVERLAP = 80
/** Most pieces we send for one screenshot. */
export const MAX_SLICES = 10

/**
 * Where to cut a tall image: [top, bottom] pairs in pixels of the scaled image.
 * Pure, so it can be tested.
 */
export function sliceBounds(height: number, slice = SLICE_HEIGHT, overlap = SLICE_OVERLAP): [number, number][] {
  if (height <= slice) return [[0, height]]
  const out: [number, number][] = []
  let top = 0
  while (top < height) {
    const bottom = Math.min(height, top + slice)
    out.push([top, bottom])
    if (bottom === height) break
    top = bottom - overlap
  }
  return out
}

/**
 * The scale for a screenshot: keep it readable (width up to SLICE_WIDTH, never
 * enlarged), unless that would need more than MAX_SLICES pieces.
 */
export function chooseScale(width: number, height: number): number {
  let scale = Math.min(1, SLICE_WIDTH / width)
  const pieces = (h: number) => sliceBounds(Math.round(h)).length
  while (pieces(height * scale) > MAX_SLICES && scale > 0.2) scale *= 0.9
  return scale
}

/**
 * Turns a photo or screenshot into readable JPEG pieces for the AI.
 * A normal photo stays one piece. A long scrolling screenshot (like a full
 * Ultimate Guitar page) becomes several overlapping pieces, top to bottom,
 * instead of being squashed until the chords are unreadable.
 */
export async function prepareScreenshot(file: File, quality = 0.85): Promise<Blob[]> {
  const bitmap = await createImageBitmap(file)
  const scale = chooseScale(bitmap.width, bitmap.height)
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const blobs: Blob[] = []
  for (const [top, bottom] of sliceBounds(height)) {
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = bottom - top
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas not available")
    ctx.fillStyle = "#ffffff" // transparent PNGs become white, not black
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // Draw the matching band of the original, scaled.
    ctx.drawImage(bitmap, 0, top / scale, bitmap.width, (bottom - top) / scale, 0, 0, width, bottom - top)
    blobs.push(
      await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), "image/jpeg", quality),
      ),
    )
  }
  bitmap.close()
  return blobs
}
