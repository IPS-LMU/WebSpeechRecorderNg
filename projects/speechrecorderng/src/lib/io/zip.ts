import {BinaryByteWriter} from "./BinaryWriter";

/**
 * A minimal ZIP archive writer with no external dependencies.
 *
 * Entries are DEFLATE-compressed (`CompressionStream('deflate-raw')`) when it shrinks them and the
 * browser supports it, and stored uncompressed otherwise (Safari/iOS before 16.4 lack
 * `deflate-raw`). The timestamps are the ZIP "no time" value (1980-01-01), so archives are
 * deterministic and diffable.
 */

const CRC_TABLE = buildCrcTable();

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
}

/** The CRC-32 (IEEE) of a byte buffer, as ZIP stores it. */
export function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/** Raw DEFLATE of a buffer; throws when the browser has no `deflate-raw` compression. */
async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data] as BlobPart[]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** DOS date/time for 1980-01-01 00:00, the ZIP convention for "no timestamp". */
const DOS_TIME = 0;
const DOS_DATE = 0x21;

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;

interface ZipEntry {
  name: string;
  data: Uint8Array;
  crc: number;
  method: number;         // 0 = stored, 8 = deflated
  compressed: Uint8Array;
}

export class ZipWriter {

  private readonly entries: ZipEntry[] = [];
  private readonly encoder = new TextEncoder();

  /** Adds a file; the bytes are copied into the archive when `generate` runs. */
  async add(name: string, data: Uint8Array): Promise<void> {
    const crc = crc32(data);
    let method = 0;
    let compressed = data;
    try {
      const deflated = await deflateRaw(data);
      if (deflated.length < data.length) {
        method = 8;
        compressed = deflated;
      }
    } catch {
      // no deflate-raw support: keep the entry uncompressed
    }
    this.entries.push({name, data, crc, method, compressed});
  }

  /** Builds the archive as a `application/zip` blob. */
  async generate(): Promise<Blob> {
    const parts: Uint8Array[] = [];
    const centralParts: Uint8Array[] = [];
    let offset = 0;
    for (const entry of this.entries) {
      const name = this.encoder.encode(entry.name);
      const local = this.localHeader(entry, name);
      parts.push(local, entry.compressed);
      centralParts.push(this.centralHeader(entry, name, offset));
      offset += local.byteLength + entry.compressed.byteLength;
    }
    const central = concat(centralParts);
    parts.push(central, this.endOfCentralDirectory(this.entries.length, central.byteLength, offset));
    return new Blob(parts as BlobPart[], {type: 'application/zip'});
  }

  private localHeader(entry: ZipEntry, name: Uint8Array): Uint8Array {
    const w = new BinaryByteWriter();
    w.writeUint32(LOCAL_SIGNATURE, true);
    w.writeUint16(20, true);              // version needed to extract
    w.writeUint16(0, true);               // general purpose flags
    w.writeUint16(entry.method, true);
    w.writeUint16(DOS_TIME, true);
    w.writeUint16(DOS_DATE, true);
    w.writeUint32(entry.crc, true);
    w.writeUint32(entry.compressed.byteLength, true);
    w.writeUint32(entry.data.byteLength, true);
    w.writeUint16(name.byteLength, true);
    w.writeUint16(0, true);               // extra field length
    return concat([writerBytes(w), name]);
  }

  private centralHeader(entry: ZipEntry, name: Uint8Array, offset: number): Uint8Array {
    const w = new BinaryByteWriter();
    w.writeUint32(CENTRAL_SIGNATURE, true);
    w.writeUint16(20, true);              // version made by
    w.writeUint16(20, true);              // version needed to extract
    w.writeUint16(0, true);               // flags
    w.writeUint16(entry.method, true);
    w.writeUint16(DOS_TIME, true);
    w.writeUint16(DOS_DATE, true);
    w.writeUint32(entry.crc, true);
    w.writeUint32(entry.compressed.byteLength, true);
    w.writeUint32(entry.data.byteLength, true);
    w.writeUint16(name.byteLength, true);
    w.writeUint16(0, true);               // extra field length
    w.writeUint16(0, true);               // file comment length
    w.writeUint16(0, true);               // disk number start
    w.writeUint16(0, true);               // internal file attributes
    w.writeUint32(0, true);               // external file attributes
    w.writeUint32(offset, true);          // relative offset of the local header
    return concat([writerBytes(w), name]);
  }

  private endOfCentralDirectory(count: number, centralSize: number, centralOffset: number): Uint8Array {
    const w = new BinaryByteWriter();
    w.writeUint32(EOCD_SIGNATURE, true);
    w.writeUint16(0, true);               // disk number
    w.writeUint16(0, true);               // disk with the central directory
    w.writeUint16(count, true);
    w.writeUint16(count, true);
    w.writeUint32(centralSize, true);
    w.writeUint32(centralOffset, true);
    w.writeUint16(0, true);               // comment length
    return writerBytes(w);
  }
}

/** The bytes written into a `BinaryByteWriter` so far, as a standalone copy. */
function writerBytes(w: BinaryByteWriter): Uint8Array {
  return new Uint8Array(w.buf, 0, w.pos).slice();
}

function concat(parts: Array<Uint8Array>): Uint8Array {
  let length = 0;
  for (const part of parts) {
    length += part.byteLength;
  }
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}
