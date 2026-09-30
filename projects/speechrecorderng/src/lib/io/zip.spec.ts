import {ZipWriter, crc32} from "./zip";

function bytes(data: Blob): Promise<Uint8Array> {
  return data.arrayBuffer().then((buffer) => new Uint8Array(buffer));
}

function u16(view: Uint8Array, offset: number): number {
  return new DataView(view.buffer, view.byteOffset, view.byteLength).getUint16(offset, true);
}

function u32(view: Uint8Array, offset: number): number {
  return new DataView(view.buffer, view.byteOffset, view.byteLength).getUint32(offset, true);
}

describe('crc32', () => {
  it('matches the IEEE reference vector', () => {
    const input = new TextEncoder().encode('123456789');
    expect(crc32(input)).toBe(0xCBF43926);
  });
});

describe('ZipWriter', () => {

  it('stores an incompressible entry with the right header and bytes', async () => {
    const data = new Uint8Array(256).map((_, i) => (i * 31 + 7) & 0xFF);   // deterministic, non-zero
    const zip = new ZipWriter();
    await zip.add('data.bin', data);
    const archive = await bytes(await zip.generate());

    expect(u32(archive, 0)).toBe(0x04034b50);           // local file header signature
    expect(u16(archive, 4)).toBe(20);                    // version needed
    expect(u16(archive, 8)).toBe(0);                     // method: stored
    expect(u32(archive, 14)).toBe(crc32(data));
    expect(u32(archive, 18)).toBe(256);                  // compressed size
    expect(u32(archive, 22)).toBe(256);                  // uncompressed size
    const nameLength = u16(archive, 26);
    expect(new TextDecoder().decode(archive.subarray(30, 30 + nameLength))).toBe('data.bin');
    expect([...archive.subarray(30 + nameLength, 30 + nameLength + 256)]).toEqual([...data]);
  });

  it('deflates a compressible entry and can round-trip the payload', async () => {
    const data = new Uint8Array(512);                    // all zeros: highly compressible
    const zip = new ZipWriter();
    await zip.add('zeros.bin', data);
    const archive = await bytes(await zip.generate());

    expect(u16(archive, 8)).toBe(8);                     // method: deflated
    expect(u32(archive, 18)).toBeLessThan(512);          // compressed size
    expect(u32(archive, 22)).toBe(512);                  // uncompressed size
    const nameLength = u16(archive, 26);
    const dataOffset = 30 + nameLength;
    const compressedSize = u32(archive, 18);
    const payload = archive.subarray(dataOffset, dataOffset + compressedSize);
    const stream = new Blob([payload as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const inflated = new Uint8Array(await new Response(stream).arrayBuffer());
    expect(inflated.length).toBe(512);
    expect(inflated.every((b) => b === 0)).toBe(true);
  });

  it('writes one central directory entry per file', async () => {
    const zip = new ZipWriter();
    await zip.add('a.txt', new TextEncoder().encode('alpha'));
    await zip.add('b.txt', new TextEncoder().encode('beta'));
    const archive = await bytes(await zip.generate());

    const text = new TextDecoder().decode(archive);
    expect(text.indexOf('a.txt')).toBeGreaterThan(-1);
    expect(text.indexOf('b.txt')).toBeGreaterThan(-1);

    // End of central directory: signature, then entry count at offset +10.
    let eocdOffset = -1;
    for (let i = archive.length - 22; i >= 0; i--) {
      if (u32(archive, i) === 0x06054b50) { eocdOffset = i; break; }
    }
    expect(eocdOffset).toBeGreaterThan(-1);
    expect(u16(archive, eocdOffset + 8)).toBe(2);        // entries on this disk
    expect(u16(archive, eocdOffset + 10)).toBe(2);       // entries in total
  });
});
