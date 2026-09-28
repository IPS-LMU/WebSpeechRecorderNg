/**
 * Streaming `multipart/form-data` parser.
 *
 * The recorder posts chunks and prepare/concat requests as FormData. Parts must be parsed
 * binary safe: a chunk part is a WAVE file and may contain any byte sequence, including
 * something that looks like the boundary. The parser therefore only ever compares inside a
 * sliding window and writes file parts straight to disk, so an upload is never buffered whole.
 */
import {createWriteStream} from 'node:fs';
import {unlink} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {RequestError} from './body.mjs';

const MAX_HEADER_BYTES = 16 * 1024;

/** Extracts the boundary parameter of a multipart content type, or null. */
export function multipartBoundary(contentType) {
  const match = /multipart\/form-data/i.exec(contentType ?? '');
  if (match === null) {
    return null;
  }
  const param = /;\s*boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  return param === null ? null : (param[1] ?? param[2]);
}

/**
 * Parses the request body.
 * Returns `{fields, files}`: `fields` maps a part name to its string value, `files` maps a
 * part name to `{path, size, filename, contentType}` on disk in `tmpDir`.
 * File parts are deleted by the caller (on success and on failure).
 */
export async function readMultipart(req, {tmpDir, maxBytes}) {
  const boundary = multipartBoundary(req.headers['content-type']);
  if (boundary === null) {
    throw new RequestError(400, 'request is not multipart/form-data or has no boundary');
  }
  const parser = new MultipartParser(boundary, tmpDir);
  let received = 0;
  try {
    for await (const chunk of req) {
      received += chunk.length;
      if (received > maxBytes) {
        throw new RequestError(413, `payload exceeds the limit of ${maxBytes} bytes (raise --max-body)`);
      }
      await parser.push(chunk);
    }
    await parser.finish();
  } catch (err) {
    await parser.dispose();
    throw err;
  }
  return {fields: parser.fields, files: parser.files};
}

class MultipartParser {
  constructor(boundary, tmpDir) {
    this.label = `--${boundary}`;
    // A data section ends with CRLF + label; the CRLF belongs to the delimiter, not to the data.
    this.delimiter = Buffer.from(`\r\n${this.label}`);
    this.tmpDir = tmpDir;
    this.pending = Buffer.alloc(0);
    this.fields = Object.create(null);
    this.files = new Map();
    this.state = 'preamble';
    this.part = null;
    this.partCount = 0;
  }

  async push(chunk) {
    this.pending = this.pending.length === 0 ? chunk : Buffer.concat([this.pending, chunk]);
    await this.consume();
  }

  async consume() {
    let progressing = true;
    while (progressing) {
      progressing = await this.step();
    }
  }

  /** Advances one state; returns false when the parser needs more input. */
  async step() {
    switch (this.state) {
      case 'preamble': {
        const label = Buffer.from(this.label);
        const at = this.pending.indexOf(label);
        if (at < 0) {
          // Keep the tail: the label may be split across two chunks.
          this.trim(label.length - 1);
          return false;
        }
        this.pending = this.pending.subarray(at + label.length);
        this.state = 'afterBoundary';
        return true;
      }
      case 'afterBoundary': {
        if (this.pending.length < 2) {
          return false;
        }
        if (this.pending[0] === 0x2d && this.pending[1] === 0x2d) {
          this.state = 'done';
          return true;
        }
        if (this.pending[0] !== 0x0d || this.pending[1] !== 0x0a) {
          throw new RequestError(400, 'malformed multipart body: expected CRLF after the boundary');
        }
        this.pending = this.pending.subarray(2);
        this.state = 'headers';
        return true;
      }
      case 'headers': {
        const end = this.pending.indexOf('\r\n\r\n');
        if (end < 0) {
          if (this.pending.length > MAX_HEADER_BYTES) {
            throw new RequestError(400, 'multipart part header is too long');
          }
          return false;
        }
        const header = this.pending.subarray(0, end).toString('utf8');
        this.pending = this.pending.subarray(end + 4);
        await this.startPart(header);
        this.state = 'body';
        return true;
      }
      case 'body': {
        const at = this.pending.indexOf(this.delimiter);
        if (at >= 0) {
          await this.writePart(this.pending.subarray(0, at));
          this.pending = this.pending.subarray(at + this.delimiter.length);
          await this.endPart();
          this.state = 'afterBoundary';
          return true;
        }
        // Keep the last delimiter.length - 1 bytes: they may be the start of a delimiter.
        if (this.pending.length >= this.delimiter.length) {
          const flush = this.pending.length - (this.delimiter.length - 1);
          await this.writePart(this.pending.subarray(0, flush));
          this.pending = this.pending.subarray(flush);
        }
        return false;
      }
      case 'done':
        return false;
      default:
        throw new Error(`multipart parser in unexpected state ${this.state}`);
    }
  }

  trim(keep) {
    if (this.pending.length > keep) {
      this.pending = this.pending.subarray(this.pending.length - keep);
    }
  }

  async startPart(header) {
    const disposition = /^content-disposition:.*$/im.exec(header)?.[0] ?? '';
    const name = /;\s*name\s*=\s*(?:"([^"]*)"|([^;\s]+))/i.exec(disposition);
    if (name === null) {
      throw new RequestError(400, 'multipart part without a name');
    }
    const filename = /;\s*filename\s*=\s*(?:"([^"]*)"|([^;\s]+))/i.exec(disposition);
    const partName = name[1] ?? name[2];
    this.partCount++;
    if (filename === null) {
      this.part = {name: partName, kind: 'field', chunks: [], size: 0};
      return;
    }
    const path = `${this.tmpDir}/part-${process.pid}-${randomBytes(6).toString('hex')}-${this.partCount}.bin`;
    const stream = createWriteStream(path);
    stream.on('error', () => {});
    this.part = {
      name: partName,
      kind: 'file',
      path,
      stream,
      size: 0,
      filename: filename[1] ?? filename[2],
      contentType: (/^content-type:\s*(.+)$/im.exec(header)?.[1] ?? 'application/octet-stream').trim(),
    };
    this.files.set(partName, {path, size: 0, filename: this.part.filename, contentType: this.part.contentType});
  }

  async writePart(buf) {
    if (buf.length === 0) {
      return;
    }
    this.part.size += buf.length;
    if (this.part.kind === 'field') {
      this.part.chunks.push(buf);
      return;
    }
    const entry = this.files.get(this.part.name);
    entry.size = this.part.size;
    await write(stream(this.part), buf);
  }

  async endPart() {
    if (this.part.kind === 'field') {
      this.fields[this.part.name] = Buffer.concat(this.part.chunks).toString('utf8');
    } else {
      await closeStream(this.part.stream);
    }
    this.part = null;
  }

  async finish() {
    if (this.state !== 'done') {
      throw new RequestError(400, `malformed multipart body: ended in state ${this.state}`);
    }
  }

  /** Removes the temp files of a failed parse. */
  async dispose() {
    for (const entry of this.files.values()) {
      await unlink(entry.path).catch(() => {});
    }
    this.files.clear();
  }
}

const stream = (part) => part.stream;

function write(out, buf) {
  return new Promise((resolve, reject) => {
    out.write(buf, (err) => (err ? reject(err) : resolve()));
  });
}

function closeStream(out) {
  return new Promise((resolve, reject) => {
    out.end((err) => (err ? reject(err) : resolve()));
  });
}
