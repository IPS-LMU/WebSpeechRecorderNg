import {Injectable} from "@angular/core";
import {WavWriter, SampleSize} from "../../audio/impl/wavwriter";
import {AudioBufferSource} from "../../audio/audio_data_holder";
import {SprRecordingFile} from "../recording";
import {SprItemsCache} from "./recording_file_cache";
import {Session} from "./session";
import {ZipWriter} from "../../io/zip";

/** How a recording is encoded into a WAVE file inside the export. */
export interface SessionExportEncoding {
  float: boolean;
  sampleSize: SampleSize;
}

/**
 * Packs the recordings of a session into one downloadable archive.
 *
 * The session keeps every take's audio client side (`items.setSprRecFileAudioData`), so the
 * export works in a standalone install where nothing was uploaded to a server: each recording
 * becomes a WAVE file and a metadata file under `recfiles/<itemcode>/`, next to `session.json`
 * and a `manifest.json` index. A recording whose audio is not held client side (NET_CHUNKED —
 * it lives on the server already) is skipped, not faked.
 */
@Injectable()
export class SessionExportService {

  private readonly encoder = new TextEncoder();

  /** Encodes one recording into a WAVE buffer; separate so the zip assembly is testable. */
  encodeAudio(audioBuffer: AudioBuffer, encoding: SessionExportEncoding): Promise<ArrayBuffer> {
    const writer = new WavWriter(encoding.float, encoding.sampleSize);
    return new Promise<ArrayBuffer>((resolve) => writer.writeAsync(audioBuffer, resolve));
  }

  /**
   * Resolves to the archive blob, or `null` when the session holds no client-side recordings.
   */
  async exportSession(
    items: SprItemsCache | null,
    session: Session | null,
    encoding: SessionExportEncoding
  ): Promise<Blob | null> {
    const zip = new ZipWriter();
    let count = 0;
    if (items) {
      for (let i = 0; i < items.length(); i++) {
        const item = items.getItem(i);
        if (!item || !item.recording) {
          continue;
        }
        const recordings = item.recs ?? [];
        for (const recording of recordings) {
          const audioBuffer = this.audioBufferOf(recording);
          if (audioBuffer === null) {
            continue;   // audio is on the server, not here
          }
          const folder = sanitize(recording.itemCode);
          const base = `recfiles/${folder}/${sanitize(recording.itemCode)}_${recording.version}`;
          const wav = await this.encodeAudio(audioBuffer, encoding);
          await zip.add(`${base}.wav`, new Uint8Array(wav));
          await zip.add(`${base}.json`, this.encoder.encode(JSON.stringify(this.metadata(recording, audioBuffer), null, 2)));
          count++;
        }
      }
    }
    if (count === 0) {
      return null;
    }
    if (session) {
      await zip.add('session.json', this.encoder.encode(JSON.stringify(session, null, 2)));
    }
    return zip.generate();
  }

  /** Triggers a browser download of a blob. */
  static download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  private audioBufferOf(recording: SprRecordingFile): AudioBuffer | null {
    const source = recording.audioDataHolder?.audioSource;
    if (source instanceof AudioBufferSource) {
      return source.audioBuffer;
    }
    return null;
  }

  private metadata(recording: SprRecordingFile, audioBuffer: AudioBuffer): Record<string, unknown> {
    return {
      session: recording.session ?? null,
      itemcode: recording.itemCode ?? null,
      version: recording.version ?? null,
      recordingFileId: recording.recordingFileId ?? null,
      uuid: recording.uuid ?? null,
      serverPersisted: recording.serverPersisted === true,
      samplerate: audioBuffer.sampleRate,
      frames: audioBuffer.length,
      channels: audioBuffer.numberOfChannels
    };
  }
}

/** Item codes become directory and file names: keep them plain. */
function sanitize(value: string | null | undefined): string {
  const name = String(value ?? '');
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, '_');
  return cleaned === '' ? '_' : cleaned;
}
