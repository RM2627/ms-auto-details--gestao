export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_JOB_PHOTOS = 12;

export function photoContentType(bytes: Uint8Array) {
  if (bytes.length < 12 || bytes.length > MAX_PHOTO_BYTES) throw new Error("Envie uma foto de até 5 MB.");
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return "image/png";
  const text = new TextDecoder().decode(bytes.slice(0, 12));
  if (text.startsWith("RIFF") && text.slice(8) === "WEBP") return "image/webp";
  throw new Error("Formato não aceito. Use fotos JPG, PNG ou WebP.");
}

export async function limitedBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit) throw new Error("Arquivo muito grande.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Envie uma foto.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new Error("Arquivo muito grande."); }
    chunks.push(value);
  }
  const result = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
