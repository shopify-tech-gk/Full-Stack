import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '@youmart/errors';
import { prisma } from '../db';
import { config } from '../config';
import { mediaPath } from './ads.service';

// v1.19 ad photos / videos. Uploaded as the raw file body (Content-Type = the file's type), checked
// by its first bytes (not just the header), stored under ADS_MEDIA_DIR with a random name, and
// recorded against the uploader so only they can put it in an ad. Served publicly by name - names
// are random and unguessable, and only approved ads are ever shown to shoppers.

const TYPES: Record<string, { ext: string; video: boolean; max: number }> = {
  'image/jpeg': { ext: 'jpg', video: false, max: 8 * 1024 * 1024 },
  'image/png': { ext: 'png', video: false, max: 8 * 1024 * 1024 },
  'image/webp': { ext: 'webp', video: false, max: 8 * 1024 * 1024 },
  'video/mp4': { ext: 'mp4', video: true, max: 60 * 1024 * 1024 },
  'video/quicktime': { ext: 'mov', video: true, max: 60 * 1024 * 1024 },
};
export const UPLOAD_TYPES = Object.keys(TYPES);
export const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;

const CONTENT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
};

/** Does the file really start like its claimed type? */
function looksLike(mime: string, b: Buffer): boolean {
  if (b.length < 12) return false;
  switch (mime) {
    case 'image/jpeg':
      return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case 'image/png':
      return b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/webp':
      return b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
    case 'video/mp4':
    case 'video/quicktime':
      return b.toString('ascii', 4, 8) === 'ftyp';
    default:
      return false;
  }
}

export async function saveUpload(userId: string, contentType: string | undefined, body: unknown) {
  const mime = String(contentType ?? '')
    .split(';')[0]!
    .trim()
    .toLowerCase();
  const type = TYPES[mime];
  if (!type) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      'Upload a JPG, PNG or WEBP photo, or an MP4 / MOV video.',
    );
  }
  if (!Buffer.isBuffer(body) || body.length === 0) {
    throw new AppError('VALIDATION_ERROR', 400, 'The file was empty.');
  }
  if (body.length > type.max) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      type.video ? 'Videos can be up to 60 MB.' : 'Photos can be up to 8 MB.',
    );
  }
  if (!looksLike(mime, body)) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      'That file does not look like a valid photo or video.',
    );
  }
  const fileName = `${randomBytes(16).toString('hex')}.${type.ext}`;
  await mkdir(config.adsMediaDir, { recursive: true });
  await writeFile(path.join(config.adsMediaDir, fileName), body);
  await prisma.adMedia.create({ data: { userId, fileName, mimeType: mime, bytes: body.length } });
  return {
    fileName,
    url: mediaPath(fileName),
    mimeType: mime,
    bytes: body.length,
    video: type.video,
  };
}

/** A stored file name -> its absolute path and type, or null when the name is not ours. */
export function mediaFile(name: string): { file: string; contentType: string } | null {
  const m = /^([a-f0-9]{32})\.(jpg|png|webp|mp4|mov)$/.exec(name);
  if (!m) return null;
  return { file: path.join(config.adsMediaDir, name), contentType: CONTENT_TYPE[m[2]!]! };
}
