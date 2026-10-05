import {Inject, Injectable, Optional} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {firstValueFrom} from "rxjs";
import {AudioContextProvider} from "./context";
import {Mediaitem} from "../speechrecorder/script/script";
import {ProjectService} from "../speechrecorder/project/project.service";
import {messageOf} from "../utils/utils";
import {SPEECHRECORDER_CONFIG, SpeechRecorderConfig} from "../spr.config";
import {SprLogger} from "../utils/logger";

/**
 * How a playback ended.
 *
 *   ended    the sound was played to the end;
 *   stopped  something stopped it (the next item, the end of the take, a replacing playback);
 *   failed   it could not be fetched, decoded or started.
 */
export type PromptAudioResult = 'ended' | 'stopped' | 'failed';

/** Prompt sounds are short; the cache only holds what a session navigates back and forth over. */
const CACHE_LIMIT = 8;

/**
 * Plays the sound of a prompt media item (`mimetype: 'audio/*'`, `src` a project resource).
 *
 * The recorder uses it to play a stimulus to the respondent and to wait for it: the take's
 * clocks start when the sound has been played to the end, so the traffic light does not say
 * "get ready" or "recording" while the respondent is still listening (see the session manager).
 *
 * Decoding and playback go through the same Web Audio path as the recorded audio
 * (`AudioContextProvider`), and a sound is fetched once per session: `prefetch` warms the cache
 * when an item becomes current, `play` then starts without a network wait.
 */
@Injectable()
export class PromptAudioService {

  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly loading = new Map<string, Promise<AudioBuffer>>();
  private readonly withCredentials: boolean;

  private source: AudioBufferSourceNode|null = null;
  private endCurrent: ((result: PromptAudioResult) => void)|null = null;
  /** The silence between the repeats of a sequence, and how to cut it short. */
  private gapTimer: number|null = null;
  private endGap: (() => void)|null = null;

  constructor(private http: HttpClient, private projectService: ProjectService,
              @Optional() @Inject(SPEECHRECORDER_CONFIG) config?: SpeechRecorderConfig) {
    this.withCredentials = config?.withCredentials === true;
  }

  /** Resolved URL of the media item's resource, or `null` when the script names none. */
  urlOf(projectName: string|null|undefined, mediaitem: Mediaitem): string|null {
    if (!projectName || !mediaitem.src) {
      return null;
    }
    return this.projectService.projectResourceUrl(projectName, mediaitem.src);
  }

  /** Loads a prompt sound into the cache. A failure is logged; `play` retries and reports it. */
  prefetch(projectName: string|null|undefined, mediaitem: Mediaitem): void {
    const url = this.urlOf(projectName, mediaitem);
    if (url === null || this.buffers.has(url)) {
      return;
    }
    this.load(url).catch((reason) => {
      SprLogger.debug("Prompt audio " + url + " not prefetched: " + messageOf(reason));
    });
  }

  /**
   * Plays a prompt sound. Resolves when it stopped playing — never rejects, a sound that cannot
   * be played must not hold up a recording session.
   */
  play(projectName: string|null|undefined, mediaitem: Mediaitem): Promise<PromptAudioResult> {
    const url = this.urlOf(projectName, mediaitem);
    if (url === null) {
      SprLogger.error("Prompt audio: media item without a project resource: " + JSON.stringify(mediaitem));
      return Promise.resolve('failed');
    }
    // One prompt at a time: a replacing playback stops the previous one, which resolves as 'stopped'.
    this.stopCurrent();
    return this.load(url)
      .then((buffer) => this.start(url, buffer))
      .catch((reason) => {
        SprLogger.error("Prompt audio " + url + " could not be played: " + messageOf(reason));
        return 'failed' as PromptAudioResult;
      });
  }

  /** Stops the sound that is playing, if any. */
  stop(): void {
    this.stopCurrent();
  }

  /**
   * Plays a prompt sound `repeats` times with `gap` ms of silence between the repeats (the
   * `playback` modifier of D-V = C). Resolves like `play`: `stopped` when anything interrupts a
   * playback or a gap, `failed` when a repeat cannot be played.
   */
  async playSequence(
    projectName: string|null|undefined,
    mediaitem: Mediaitem,
    {repeats = 1, gap = 0}: {repeats?: number, gap?: number} = {},
  ): Promise<PromptAudioResult> {
    const total = Math.max(1, Math.floor(repeats));
    for (let index = 0; index < total; index++) {
      if (index > 0 && gap > 0 && !(await this.waitGap(gap))) {
        return 'stopped';
      }
      const result = await this.play(projectName, mediaitem);
      if (result !== 'ended') {
        return result;
      }
    }
    return 'ended';
  }

  /** The silence between repeats; false when `stop()` cut it short. */
  private waitGap(ms: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const finish = (waited: boolean) => {
        if (this.gapTimer !== null) {
          window.clearTimeout(this.gapTimer);
          this.gapTimer = null;
        }
        this.endGap = null;
        resolve(waited);
      };
      this.endGap = () => finish(false);
      this.gapTimer = window.setTimeout(() => finish(true), ms);
    });
  }

  private load(url: string): Promise<AudioBuffer> {
    const cached = this.buffers.get(url);
    if (cached !== undefined) {
      return Promise.resolve(cached);
    }
    const running = this.loading.get(url);
    if (running !== undefined) {
      return running;
    }
    const request = firstValueFrom(this.http.get(url, {responseType: 'arraybuffer', withCredentials: this.withCredentials}))
      .then((data) => AudioContextProvider.decodeAudioData(data))
      .then((buffer) => {
        this.loading.delete(url);
        this.remember(url, buffer);
        return buffer;
      })
      .catch((reason) => {
        this.loading.delete(url);
        throw reason;
      });
    this.loading.set(url, request);
    return request;
  }

  private remember(url: string, buffer: AudioBuffer): void {
    this.buffers.delete(url);
    this.buffers.set(url, buffer);
    while (this.buffers.size > CACHE_LIMIT) {
      const oldest = this.buffers.keys().next().value;
      if (oldest === undefined) {
        return;
      }
      this.buffers.delete(oldest);
    }
  }

  private start(url: string, buffer: AudioBuffer): Promise<PromptAudioResult> {
    let context: AudioContext;
    try {
      const instance = AudioContextProvider.audioContextInstance();
      if (instance === null) {
        return Promise.resolve('failed');
      }
      context = instance;
    } catch (reason) {
      SprLogger.error("Prompt audio: no audio context: " + messageOf(reason));
      return Promise.resolve('failed');
    }
    // The context starts suspended until the document has been activated; the take is started
    // by a key press or a click, so resuming here is the gesture that unlocks audible playback.
    const ready = context.state === 'running' ? Promise.resolve() : context.resume();
    return ready.then(() => new Promise<PromptAudioResult>((resolve) => {
      let done = false;
      const finish = (result: PromptAudioResult) => {
        if (done) {
          return;
        }
        done = true;
        if (this.source === source) {
          this.source = null;
          this.endCurrent = null;
        }
        resolve(result);
      };
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => finish('ended');
      this.source = source;
      this.endCurrent = finish;
      SprLogger.debug("Prompt audio " + url + " playing, " + buffer.duration.toFixed(2) + "s.");
      source.start();
    })).catch((reason) => {
      SprLogger.error("Prompt audio " + url + " could not be started: " + messageOf(reason));
      return 'failed' as PromptAudioResult;
    });
  }

  private stopCurrent(): void {
    const endGap = this.endGap;
    this.endGap = null;
    if (this.gapTimer !== null) {
      window.clearTimeout(this.gapTimer);
      this.gapTimer = null;
    }
    if (endGap !== null) {
      endGap();
    }
    const source = this.source;
    const finish = this.endCurrent;
    this.source = null;
    this.endCurrent = null;
    if (source !== null) {
      source.onended = null;
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // a source that already ended, or a context that is gone: nothing left to stop
      }
    }
    if (finish !== null) {
      finish('stopped');
    }
  }
}
