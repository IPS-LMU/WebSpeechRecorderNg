/**
 * Project media (playback clips and image prompts): name hygiene, MIME lookup and the reference
 * scan that keeps a file from being replaced or deleted out from under a published script.
 *
 * Media are ordinary project resources, so the recorder fetches them through the path it already
 * uses for image prompts (`project/{p}/media/<name>`); nothing new is added to the recorder.
 */
export const MEDIA_DIR = 'media';

const MIME_BY_EXTENSION = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.webm': 'audio/webm',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
};

const EXTENSION_BY_MIME = {
  'audio/wav': '.wav',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/ogg': '.ogg',
  'audio/webm': '.webm',
  'video/mp4': '.mp4',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/svg+xml': '.svg',
  'image/gif': '.gif',
};

/** MIME type from the file extension, else `application/octet-stream`. */
export function mimeTypeFor(name) {
  const dot = String(name ?? '').lastIndexOf('.');
  return dot < 0 ? 'application/octet-stream' : MIME_BY_EXTENSION[String(name).slice(dot).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * The stored name for an upload: the basename of the client's name (so a path cannot escape the
 * media directory), control characters removed, leading dots dropped. A missing name falls back to
 * `upload` plus the extension implied by the content type.
 */
export function sanitiseMediaName(rawName, contentType = '') {
  const basename = String(rawName ?? '').split(/[\\/]/).pop() ?? '';
  const cleaned = basename.replace(/[\u0000-\u001f\u007f]/g, '').replace(/^\.+/, '').trim();
  if (cleaned !== '' && cleaned !== '.') {
    return cleaned;
  }
  const mime = String(contentType ?? '').split(';')[0].trim().toLowerCase();
  return `upload${EXTENSION_BY_MIME[mime] ?? ''}`;
}

/**
 * Every project-relative resource a script document refers to: the `src` of any mediaitem and the
 * `audioSrc` of a bank item (both are project resources). Walked over drafts and published versions.
 */
export function referencedResources(document) {
  const found = new Set();
  const walk = (node) => {
    if (Array.isArray(node)) {
      for (const entry of node) {
        walk(entry);
      }
      return;
    }
    if (node === null || typeof node !== 'object') {
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if ((key === 'src' || key === 'audioSrc') && typeof value === 'string' && value.trim() !== '') {
        found.add(value.trim());
      } else {
        walk(value);
      }
    }
  };
  walk(document);
  return found;
}

/** Clip length in milliseconds from a `probeWav` result, or null when it cannot be derived. */
export function durationMsOf(wavMeta) {
  if (!wavMeta || !Number.isFinite(wavMeta.frames) || !Number.isFinite(wavMeta.sampleRate) || wavMeta.sampleRate <= 0) {
    return null;
  }
  return Math.round((wavMeta.frames / wavMeta.sampleRate) * 1000);
}
