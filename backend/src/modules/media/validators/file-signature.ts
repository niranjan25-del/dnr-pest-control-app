// src/modules/media/validators/file-signature.ts
//
// Magic-byte MIME sniffing — never trust the client-declared content type alone. Returns the
// MIME inferred from the file's leading bytes, or null if unrecognized. Used by
// FileValidatorService to confirm the declared type matches the actual bytes.

export function detectMimeFromBuffer(buf: Buffer): string | null {
  if (buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';

  // WEBP: "RIFF" .... "WEBP"
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';

  // PDF: 25 50 44 46 ("%PDF")
  if (buf.toString('ascii', 0, 4) === '%PDF') return 'application/pdf';

  return null;
}

// Normalize equivalent declared types (e.g. image/jpg → image/jpeg).
export function normalizeMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m === 'image/jpg') return 'image/jpeg';
  return m;
}
