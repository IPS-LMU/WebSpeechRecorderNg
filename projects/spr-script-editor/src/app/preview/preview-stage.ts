/**
 * What the preview's stage renders for one item (ui-spec §4, §9).
 *
 * The stage is beige hardware in the recorder; here it is a faithful, text-first mock of it. The
 * one case ui-spec §9 names explicitly is the error state: "a missing playback file shows a
 * labelled placeholder, not a silent gap". That check needs the project's media list — the read
 * endpoint `GET project/{p}/media` (rest-api.md §5) — so `stageParts` takes the set of known files
 * and reports `audio-missing` when a declared `src` is not in it. `null` means the list could not
 * be read; then nothing is claimed to be missing (an unknown is not a failure).
 *
 * The media kind comes from the library's `MediaitemUtil.kind`, so the editor and the recorder
 * agree on what `text/plain`, `text/x-prompt`, `image/*` and `audio/*` mean.
 */
import {MediaitemUtil, type Mediaitem, type PromptItem} from 'speechrecorderng';
import {BANK_MOCK_SRC_PREFIX} from './preview-draw';

export type StagePartKind = 'text' | 'prompt' | 'image' | 'audio' | 'audio-missing' | 'bank-audio' | 'unsupported';

export interface StagePart {
  kind: StagePartKind;
  /** The prompt text, or the detail line of a media chip (a file name, an alt text). */
  text: string;
  src: string | null;
  /** Clip length from the media list, when it is known. */
  durationMs: number | null;
}

/** `src` → `durationMs` of `GET project/{p}/media`; null when the list is unknown. */
export type MediaIndex = ReadonlyMap<string, number | null>;

function audioPart(mediaitem: Mediaitem, media: MediaIndex | null): StagePart {
  const src = (mediaitem.src ?? '').trim();
  if (src.startsWith(BANK_MOCK_SRC_PREFIX)) {
    // A drawn example's model recording: the server materialises it at session creation.
    return {kind: 'bank-audio', text: src.slice(BANK_MOCK_SRC_PREFIX.length), src: null, durationMs: null};
  }
  if (src === '') {
    return {kind: 'audio-missing', text: '', src: null, durationMs: null};
  }
  if (media !== null && !media.has(src)) {
    return {kind: 'audio-missing', text: src, src, durationMs: null};
  }
  return {kind: 'audio', text: src, src, durationMs: media?.get(src) ?? null};
}

/** Everything the stage shows for an item, in model order. */
export function stageParts(item: PromptItem | null | undefined, media: MediaIndex | null): StagePart[] {
  return (item?.mediaitems ?? []).map((mediaitem) => {
    switch (MediaitemUtil.kind(mediaitem)) {
      case 'audio':
        return audioPart(mediaitem, media);
      case 'prompt':
        return {kind: 'prompt', text: MediaitemUtil.toPlainTextString(mediaitem) ?? '', src: null, durationMs: null};
      case 'image':
        return {
          kind: 'image',
          text: (mediaitem.alt ?? '').trim() || (mediaitem.src ?? ''),
          src: mediaitem.src ?? null,
          durationMs: null,
        };
      case 'unsupported':
        return {kind: 'unsupported', text: MediaitemUtil.mimeType(mediaitem), src: null, durationMs: null};
      case 'text':
      default:
        return {
          kind: 'text',
          text: mediaitem.text ?? MediaitemUtil.toPlainTextString(mediaitem) ?? '',
          src: null,
          durationMs: null,
        };
    }
  });
}

/** The item's prompt as one line, for the order list's detail (audio and images are not text). */
export function promptTextOf(item: PromptItem | null | undefined): string {
  return stageParts(item, null)
    .filter((part) => part.kind === 'text' || part.kind === 'prompt')
    .map((part) => part.text.trim())
    .filter((text) => text !== '')
    .join(' ');
}
