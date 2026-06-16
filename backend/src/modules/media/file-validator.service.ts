// src/modules/media/file-validator.service.ts
//
// Upload validation: enforces per-category size caps, the declared content type against the
// category allowlist, AND the actual file bytes (magic-byte sniffing) so a renamed/ spoofed
// file can't slip through. Throws standardized INVALID_FILE_TYPE / FILE_TOO_LARGE errors.

import { BadRequestException, Injectable } from '@nestjs/common';
import { CATEGORY_CONFIG, MediaCategory } from './enums';
import { detectMimeFromBuffer, normalizeMime } from './validators/file-signature';

export interface ValidatedFile {
  contentType: string;
  sizeBytes: number;
}

@Injectable()
export class FileValidatorService {
  /** Validate an in-memory uploaded file (multipart path). */
  validateBuffer(category: MediaCategory, file: { buffer: Buffer; mimetype: string; size: number }): ValidatedFile {
    const policy = CATEGORY_CONFIG[category];
    const declared = normalizeMime(file.mimetype);

    if (file.size > policy.maxBytes) {
      throw new BadRequestException({ code: 'FILE_TOO_LARGE', message: `File exceeds the ${Math.round(policy.maxBytes / (1024 * 1024))}MB limit for this category` });
    }
    if (!policy.mimes.has(declared)) {
      throw new BadRequestException({ code: 'INVALID_FILE_TYPE', message: 'File type is not allowed for this category' });
    }
    const sniffed = detectMimeFromBuffer(file.buffer);
    if (!sniffed || normalizeMime(sniffed) !== declared) {
      throw new BadRequestException({ code: 'INVALID_FILE_TYPE', message: 'File contents do not match the declared type' });
    }
    return { contentType: declared, sizeBytes: file.size };
  }

  /** Validate metadata for a presigned (client-direct) upload — bytes are checked client-side. */
  validateDeclared(category: MediaCategory, contentType: string, sizeBytes?: number): string {
    const policy = CATEGORY_CONFIG[category];
    const declared = normalizeMime(contentType);
    if (!policy.mimes.has(declared)) {
      throw new BadRequestException({ code: 'INVALID_FILE_TYPE', message: 'File type is not allowed for this category' });
    }
    if (sizeBytes && sizeBytes > policy.maxBytes) {
      throw new BadRequestException({ code: 'FILE_TOO_LARGE', message: 'File exceeds the size limit for this category' });
    }
    return declared;
  }
}
