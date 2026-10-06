import {SessionExportEncoding, SessionExportService} from "./session_export";
import {Item} from "./item";
import {SprItemsCache} from "./recording_file_cache";
import {SprRecordingFile} from "../recording";
import {AudioBufferSource, AudioDataHolder} from "../../audio/audio_data_holder";
import {SampleSize} from "../../audio/impl/wavwriter";

function fakeBuffer(sampleRate = 48000, length = 960, channels = 1): AudioBuffer {
  return {sampleRate, length, numberOfChannels: channels} as unknown as AudioBuffer;
}

function recording(itemcode: string, version: number): SprRecordingFile {
  return new SprRecordingFile(9, itemcode, version, new AudioDataHolder(new AudioBufferSource(fakeBuffer())));
}

const ENCODING: SessionExportEncoding = {float: false, sampleSize: SampleSize.INT16};

describe('SessionExportService', () => {
  let service: SessionExportService;

  beforeEach(() => {
    service = new SessionExportService();
  });

  it('packs every client-side recording with its metadata', async () => {
    spyOn(service, 'encodeAudio').and.callFake(async () => new Uint8Array([1, 2, 3, 4]).buffer);

    const cache = new SprItemsCache();
    const item = new Item('hello', false, true);
    item.recs = [recording('A0', 0), recording('A0', 1)];
    cache.addItem(item);

    const blob = await service.exportSession(cache, {sessionId: 9} as never, ENCODING);
    expect(blob).not.toBeNull();
    expect(service.encodeAudio).toHaveBeenCalledTimes(2);

    const archive = new Uint8Array(await blob!.arrayBuffer());
    const names = new TextDecoder('latin1').decode(archive);
    expect(names.indexOf('recfiles/A0/A0_0.wav')).toBeGreaterThan(-1);
    expect(names.indexOf('recfiles/A0/A0_0.json')).toBeGreaterThan(-1);
    expect(names.indexOf('recfiles/A0/A0_1.wav')).toBeGreaterThan(-1);
    expect(names.indexOf('session.json')).toBeGreaterThan(-1);
  });

  it('skips non-recording items and recordings without client-side audio', async () => {
    spyOn(service, 'encodeAudio').and.callFake(async () => new Uint8Array([1]).buffer);

    const cache = new SprItemsCache();
    const instruction = new Item('instruction', false, false);   // not a recording item
    instruction.recs = null;
    cache.addItem(instruction);

    const item = new Item('hello', false, true);
    item.recs = [new SprRecordingFile(9, 'A0', 0, null)];         // no audio held client side
    cache.addItem(item);

    const blob = await service.exportSession(cache, null, ENCODING);
    expect(blob).toBeNull();
    expect(service.encodeAudio).not.toHaveBeenCalled();
  });

  it('returns null for an empty or missing session', async () => {
    spyOn(service, 'encodeAudio');
    expect(await service.exportSession(null, null, ENCODING)).toBeNull();
    expect(await service.exportSession(new SprItemsCache(), null, ENCODING)).toBeNull();
    expect(service.encodeAudio).not.toHaveBeenCalled();
  });
});
