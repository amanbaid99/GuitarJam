"use client"

/**
 * Shrinks a photo or screenshot before upload: longest side at most
 * `maxSide` px, saved as JPEG. Keeps uploads small and fast on mobile data,
 * and is plenty for reading chord charts.
 */
export async function downscaleImage(file: File, maxSide = 1800, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas not available")
  ctx.fillStyle = "#ffffff" // transparent PNGs become white, not black
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), "image/jpeg", quality),
  )
}
