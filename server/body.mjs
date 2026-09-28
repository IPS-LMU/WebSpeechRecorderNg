/**
 * Request body helpers: a size capped JSON reader and a spooling writer for binary uploads.
 *
 * Recordings are posted as raw WAVE bytes and may be large, so they are streamed to a temp
 * file instead of buffered: the receiver must not hold a whole session in memory.
 */
import {createWriteStream} from 'node:fs';
import {unlink} from 'node:fs/promises';
import {pipeline} from 'node:stream/promises';

/** An error that the API layer answers with the given HTTP status and a JSON `{error}` body. */
export class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Streams the request body into `targetPath`; returns the number of bytes written. */
export async function streamToFile(req, targetPath, {maxBytes}) {
  const declared = Number(req.headers['content-length'] ?? NaN);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new RequestError(413, `payload of ${declared} bytes exceeds the limit of ${maxBytes} bytes (raise --max-body)`);
  }
  let written = 0;
  try {
    await pipeline(
      req,
      async function* (source) {
        for await (const chunk of source) {
          written += chunk.length;
          if (written > maxBytes) {
            throw new RequestError(413, `payload exceeds the limit of ${maxBytes} bytes (raise --max-body)`);
          }
          yield chunk;
        }
      },
      createWriteStream(targetPath),
    );
  } catch (err) {
    await unlink(targetPath).catch(() => {});
    throw err;
  }
  return written;
}

/** Reads a small JSON body (PATCH requests). Empty bodies become `{}`. */
export async function readJsonBody(req, {maxBytes = 1 << 20} = {}) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      throw new RequestError(413, `request body exceeds ${maxBytes} bytes`);
    }
    chunks.push(chunk);
  }
  if (size === 0) {
    return {};
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (text === '') {
    return {};
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new RequestError(400, 'request body must be a JSON object');
    }
    return parsed;
  } catch (err) {
    if (err instanceof RequestError) {
      throw err;
    }
    throw new RequestError(400, `request body is not valid JSON: ${err.message}`);
  }
}
