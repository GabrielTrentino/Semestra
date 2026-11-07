import { shell } from "../../lib/semestraBridge";

/** Formats we hand to the main process as-is (no re-encoding). */
const PASSTHROUGH = new Set(["image/gif", "image/svg+xml"]);

const WEBP_QUALITY = 0.85;

/**
 * Re-encode a pasted screenshot to WebP. A PNG screen capture of a slide is
 * typically 300-800 KB; the same frame as WebP/85 lands around 10-15% of that
 * with no visible difference on slide text.
 *
 * Animated GIFs and SVGs are passed through untouched — canvas would flatten
 * the first to a single frame and rasterize the second.
 */
async function encode(file: Blob): Promise<{ mime: string; data: Uint8Array }> {
  const original = {
    mime: file.type,
    data: new Uint8Array(await file.arrayBuffer()),
  };
  if (PASSTHROUGH.has(file.type)) return original;

  try {
    const bitmap = await createImageBitmap(file);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await canvas.convertToBlob({
      type: "image/webp",
      quality: WEBP_QUALITY,
    });
    // Only take the conversion if it actually won.
    if (blob.type === "image/webp" && blob.size < original.data.byteLength) {
      return {
        mime: "image/webp",
        data: new Uint8Array(await blob.arrayBuffer()),
      };
    }
  } catch {
    // Fall through to the original bytes.
  }
  return original;
}

export type ImageInsert = { ok: true; markdown: string } | { ok: false; error: string };

/** Save one image file into the data folder and return the markdown for it. */
export async function saveImageFile(file: File | Blob, altHint?: string): Promise<ImageInsert> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Isso não é uma imagem." };
  }
  const { mime, data } = await encode(file);
  const res = await shell.data.saveImage({ mime, data });
  if (!res.ok) return { ok: false, error: res.error };
  const alt = (altHint ?? "").replace(/[[\]]/g, "").trim();
  return { ok: true, markdown: `![${alt}](assets/${res.name})` };
}

/** Pull image files out of a paste or drop, ignoring plain-text payloads. */
export function imagesFromTransfer(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  const out: File[] = [];
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const f = item.getAsFile();
      if (f) out.push(f);
    }
  }
  if (out.length === 0) {
    for (const f of Array.from(dt.files ?? [])) {
      if (f.type.startsWith("image/")) out.push(f);
    }
  }
  return out;
}
