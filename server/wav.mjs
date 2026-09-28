/**
 * WAVE helpers for the receiver: header parsing, slicing and concatenation.
 *
 * The recorder writes canonical RIFF/WAVE (see `wavwriter.ts`): PCM 16 bit signed or 32 bit
 * float, little endian, one `fmt ` chunk and one `data` chunk. Chunked uploads post one such
 * file per 30 s chunk, so concatenation must merge data payloads and rebuild the header
 * instead of appending bytes.
 *
 * Parsing tolerates extra chunks (LIST, fact, bext) and non canonical header sizes, because
 * the payload may have been produced by another tool before it was uploaded.
 */
import {createReadStream, createWriteStream, openSync, readSync, closeSync, writeSync, statSync} from 'node:fs';
import {pipeline} from 'node:stream/promises';

/** Raised when a payload is not a usable WAVE file. Maps to HTTP 400 at the API layer. */
export class WavError extends Error {}

const HEADER_BYTES = 44;
const fmt = (audioFormat, channels, sampleRate, bitsPerSample) => ({audioFormat, channels, sampleRate, bitsPerSample});

/** Reads the RIFF header of `filePath` without loading the payload. */
export function probeWav(filePath) {
  const fd = openSync(filePath, 'r');
  try {
    const size = statSync(filePath).size;
    const headLen = Math.min(size, 1 << 20);
    const head = Buffer.alloc(headLen);
    readSync(fd, head, 0, headLen, 0);
    const meta = parseWavHead(head);
    if (meta === null) {
      throw new WavError('not a RIFF/WAVE file');
    }
    if (meta.dataOffset + meta.dataBytes > size) {
      // A truncated upload would otherwise be published as a valid recording.
      throw new WavError(`WAVE data chunk is truncated: header announces ${meta.dataBytes} bytes, file has ${size - meta.dataOffset}`);
    }
    return meta;
  } finally {
    closeSync(fd);
  }
}

/** Parses the RIFF chunks of a buffer that starts at the file offset 0. */
export function parseWavHead(buf) {
  if (buf.length < 12 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WAVE') {
    return null;
  }
  let pos = 12;
  let format = null;
  let dataOffset = -1;
  let dataBytes = 0;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('latin1', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === 'fmt ' && body + 16 <= buf.length) {
      const audioFormat = buf.readUInt16LE(body);
      const channels = buf.readUInt16LE(body + 2);
      const sampleRate = buf.readUInt32LE(body + 4);
      const bitsPerSample = buf.readUInt16LE(body + 14);
      if (channels === 0 || sampleRate === 0 || bitsPerSample === 0) {
        throw new WavError('WAVE fmt chunk has zero channels, sample rate or sample size');
      }
      if (audioFormat !== 1 && audioFormat !== 3) {
        throw new WavError(`unsupported WAVE format tag ${audioFormat} (only PCM and IEEE float are supported)`);
      }
      format = fmt(audioFormat, channels, sampleRate, bitsPerSample);
    } else if (id === 'data') {
      dataOffset = body;
      dataBytes = size;
    }
    pos = body + size + (size % 2); // chunks are word aligned
  }
  if (format === null) {
    throw new WavError('WAVE file has no fmt chunk');
  }
  if (dataOffset < 0) {
    throw new WavError('WAVE file has no data chunk');
  }
  const blockAlign = format.channels * (format.bitsPerSample >> 3);
  const frames = Math.floor(dataBytes / blockAlign);
  return {
    ...format,
    encoding: format.audioFormat === 3 ? 'PCM_FLOAT' : 'PCM_SIGNED',
    quantisation: format.bitsPerSample,
    blockAlign,
    dataOffset,
    dataBytes: frames * blockAlign,
    frames,
  };
}

/** Builds a canonical 44 byte header for `dataBytes` payload bytes. */
export function buildWavHeader(meta, dataBytes) {
  const header = Buffer.alloc(HEADER_BYTES);
  const blockAlign = meta.channels * (meta.bitsPerSample >> 3);
  const byteRate = meta.sampleRate * blockAlign;
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(36 + dataBytes, 4);
  header.write('WAVE', 8, 'latin1');
  header.write('fmt ', 12, 'latin1');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(meta.audioFormat, 20);
  header.writeUInt16LE(meta.channels, 22);
  header.writeUInt32LE(meta.sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(meta.bitsPerSample, 34);
  header.write('data', 36, 'latin1');
  header.writeUInt32LE(dataBytes, 40);
  return header;
}

/**
 * Reads `frameLength` frames starting at `startFrame` and returns a standalone WAVE buffer.
 * Returns null when `startFrame` is at or behind the end of the file: the client reads
 * sections until the server answers 404 and treats that as the end of the recording.
 */
export function readWavSection(filePath, meta, startFrame, frameLength) {
  if (startFrame >= meta.frames || frameLength <= 0) {
    return null;
  }
  const frames = Math.min(frameLength, meta.frames - startFrame);
  const length = frames * meta.blockAlign;
  const buf = Buffer.alloc(HEADER_BYTES + length);
  buildWavHeader(meta, length).copy(buf, 0);
  const fd = openSync(filePath, 'r');
  try {
    let done = 0;
    while (done < length) {
      const read = readSync(fd, buf, HEADER_BYTES + done, length - done, meta.dataOffset + startFrame * meta.blockAlign + done);
      if (read <= 0) {
        throw new WavError('unexpected end of WAVE file while reading a section');
      }
      done += read;
    }
  } finally {
    closeSync(fd);
  }
  return buf;
}

async function appendPayload(sourcePath, meta, targetPath) {
  if (meta.dataBytes === 0) {
    return;
  }
  await pipeline(
    createReadStream(sourcePath, {start: meta.dataOffset, end: meta.dataOffset + meta.dataBytes - 1}),
    createWriteStream(targetPath, {flags: 'a'}),
  );
}

/**
 * Concatenates the chunk files, in ascending chunk index, into `targetPath`.
 * Every chunk must carry the same format: the client records all chunks of a recording in
 * one capture session, so a mismatch means the uploads of two recordings got mixed up.
 */
export async function concatWavFiles(chunkPaths, targetPath) {
  if (chunkPaths.length === 0) {
    throw new WavError('no chunks to concatenate');
  }
  const metas = chunkPaths.map((p) => probeWav(p));
  const first = metas[0];
  metas.forEach((m, i) => {
    if (m.channels !== first.channels || m.sampleRate !== first.sampleRate || m.bitsPerSample !== first.bitsPerSample || m.audioFormat !== first.audioFormat) {
      throw new WavError(`chunk ${i} has format ${m.channels}ch/${m.sampleRate}Hz/${m.bitsPerSample}bit, chunk 0 has ${first.channels}ch/${first.sampleRate}Hz/${first.bitsPerSample}bit`);
    }
  });
  const dataBytes = metas.reduce((sum, m) => sum + m.dataBytes, 0);
  const out = openSync(targetPath, 'w');
  try {
    const header = buildWavHeader(first, dataBytes);
    writeSync(out, header, 0, header.length, 0);
  } finally {
    closeSync(out);
  }
  for (let i = 0; i < chunkPaths.length; i++) {
    await appendPayload(chunkPaths[i], metas[i], targetPath);
  }
  return {...first, dataOffset: HEADER_BYTES, dataBytes, frames: Math.floor(dataBytes / first.blockAlign)};
}
