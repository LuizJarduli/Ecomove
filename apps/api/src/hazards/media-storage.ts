import { randomUUID } from "node:crypto";

export const MAX_WEBP_BYTES = 300 * 1024; // 300 KB (ADR-0005)

export class MediaPayloadTooLargeError extends Error {
  constructor(message = "A imagem WebP excede o limite máximo de 300 KB (ADR-0005).") {
    super(message);
  }
}

export interface MediaStorageService {
  storeHazardPhoto(input: { base64Webp?: string; photoUrl?: string }): Promise<string>;
}

export class LocalSparkMediaStorageService implements MediaStorageService {
  async storeHazardPhoto(input: { base64Webp?: string; photoUrl?: string }): Promise<string> {
    if (input.base64Webp) {
      const cleaned = input.base64Webp.replace(/^data:image\/webp;base64,/, "");
      const byteLength = Buffer.byteLength(cleaned, "base64");
      if (byteLength > MAX_WEBP_BYTES) {
        throw new MediaPayloadTooLargeError();
      }
      return `/media/hazards/${randomUUID()}.webp`;
    }
    if (input.photoUrl) {
      return input.photoUrl;
    }
    return `/media/hazards/${randomUUID()}.webp`;
  }
}
