import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from "@angular/common/http";
import {HttpTestingController, provideHttpClientTesting} from "@angular/common/http/testing";
import {PromptAudioResult, PromptAudioService} from "./prompt_audio";
import {AudioContextProvider} from "./context";
import {ProjectService} from "../speechrecorder/project/project.service";
import {Mediaitem} from "../speechrecorder/script/script";

const SOUND_URL = '/api/v1/project/Demo1/resources/audio/cue.wav';
const SOUND: Mediaitem = {mimetype: 'audio/wav', src: 'resources/audio/cue.wav'};

/** Lets the fetch → decode → start chain of the service run to completion. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

class FakeSource {
  buffer: AudioBuffer|null = null;
  onended: (() => void)|null = null;
  connected = false;
  started = 0;
  stopped = 0;
  disconnected = 0;

  connect(): void { this.connected = true; }
  disconnect(): void { this.disconnected++; }
  start(): void { this.started++; }
  stop(): void { this.stopped++; }

  /** What the browser does when the sound reaches its end. */
  end(): void { this.onended?.(); }
}

class FakeContext {
  state: AudioContextState = 'running';
  destination = {};
  resumed = 0;
  readonly created: FakeSource[] = [];

  createBufferSource(): AudioBufferSourceNode {
    const source = new FakeSource();
    this.created.push(source);
    return source as unknown as AudioBufferSourceNode;
  }

  resume(): Promise<void> { this.resumed++; this.state = 'running'; return Promise.resolve(); }

  get source(): FakeSource { return this.created[this.created.length - 1]; }
}

describe('PromptAudioService', () => {
  let service: PromptAudioService;
  let httpMock: HttpTestingController;
  let context: FakeContext;

  beforeEach(() => {
    context = new FakeContext();
    spyOn(AudioContextProvider, 'decodeAudioData').and.callFake(() => Promise.resolve(
      {duration: 0.5, length: 24000, numberOfChannels: 1, sampleRate: 48000} as AudioBuffer));
    spyOn(AudioContextProvider, 'audioContextInstance').and.callFake(() => context as unknown as AudioContext);
    TestBed.configureTestingModule({
      providers: [
        PromptAudioService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {provide: ProjectService, useValue: {projectResourceUrl: (project: string, src: string) => `/api/v1/project/${project}/${src}`}},
      ]
    });
    service = TestBed.inject(PromptAudioService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function flushSound(url = SOUND_URL): void {
    httpMock.expectOne(url).flush(new Uint8Array([1, 2, 3]).buffer);
  }

  it('resolves the resource URL of a media item, and null without a script source', () => {
    expect(service.urlOf('Demo1', SOUND)).toBe(SOUND_URL);
    expect(service.urlOf(null, SOUND)).toBeNull();
    expect(service.urlOf('Demo1', {mimetype: 'audio/wav'})).toBeNull();
  });

  it('fetches a prompt sound once, for prefetch and playback', async () => {
    service.prefetch('Demo1', SOUND);
    flushSound();
    await settle();

    const playing = service.play('Demo1', SOUND);
    httpMock.expectNone(SOUND_URL);
    await settle();
    expect(context.source.connected).toBe(true);
    expect(context.source.started).toBe(1);
    context.source.end();
    await expectAsync(playing).toBeResolvedTo('ended' as PromptAudioResult);
  });

  it('resolves with ended when the sound plays through', async () => {
    const playing = service.play('Demo1', SOUND);
    expect(context.created.length).toBe(0);   // nothing plays before the sound is decoded
    flushSound();
    await settle();
    expect(context.created.length).toBe(1);
    context.source.end();
    await expectAsync(playing).toBeResolvedTo('ended' as PromptAudioResult);
  });

  it('resolves with stopped when a stop interrupts the playback, and only once', async () => {
    const playing = service.play('Demo1', SOUND);
    flushSound();
    await settle();
    const source = context.source;
    service.stop();
    await expectAsync(playing).toBeResolvedTo('stopped' as PromptAudioResult);
    expect(source.stopped).toBe(1);
    expect(source.disconnected).toBe(1);
    // A source that ended after the stop must not resolve the playback a second time.
    source.end();
    await expectAsync(playing).toBeResolvedTo('stopped' as PromptAudioResult);
  });

  it('stops the running sound when the next one starts', async () => {
    const first = service.play('Demo1', SOUND);
    flushSound();
    await settle();
    const firstSource = context.source;

    const second = service.play('Demo1', SOUND);
    await expectAsync(first).toBeResolvedTo('stopped' as PromptAudioResult);
    expect(firstSource.stopped).toBe(1);
    await settle();
    expect(context.created.length).toBe(2);
    context.source.end();
    await expectAsync(second).toBeResolvedTo('ended' as PromptAudioResult);
  });

  it('resolves with failed instead of rejecting when the sound cannot be fetched', async () => {
    const playing = service.play('Demo1', SOUND);
    httpMock.expectOne(SOUND_URL).error(new ProgressEvent('error'));
    await expectAsync(playing).toBeResolvedTo('failed' as PromptAudioResult);
  });

  it('resolves with failed when the sound cannot be decoded', async () => {
    (AudioContextProvider.decodeAudioData as jasmine.Spy).and.returnValue(Promise.reject(new Error('no wav')));
    const playing = service.play('Demo1', SOUND);
    flushSound();
    await expectAsync(playing).toBeResolvedTo('failed' as PromptAudioResult);
  });

  it('resolves with failed when the browser has no audio context, and for a media item without a source', async () => {
    (AudioContextProvider.audioContextInstance as jasmine.Spy).and.returnValue(null);
    const playing = service.play('Demo1', SOUND);
    flushSound();
    await expectAsync(playing).toBeResolvedTo('failed' as PromptAudioResult);

    await expectAsync(service.play('Demo1', {mimetype: 'audio/wav'})).toBeResolvedTo('failed' as PromptAudioResult);
  });

  it('resumes a suspended context before starting the sound', async () => {
    context.state = 'suspended';
    const playing = service.play('Demo1', SOUND);
    flushSound();
    await settle();
    expect(context.resumed).toBe(1);
    expect(context.source.started).toBe(1);
    context.source.end();
    await expectAsync(playing).toBeResolvedTo('ended' as PromptAudioResult);
  });
});
