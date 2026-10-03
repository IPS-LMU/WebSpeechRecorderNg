import type {PromptItem} from 'speechrecorderng';
import {BANK_MOCK_SRC_PREFIX} from './preview-draw';
import {promptTextOf, stageParts, type MediaIndex} from './preview-stage';

const MEDIA: MediaIndex = new Map([
  ['media/model-01.wav', 1000],
  ['media/unknown-length.wav', null],
]);

describe('preview stage parts', () => {
  it('renders the prompt text and the audio as a labelled chip', () => {
    const parts = stageParts(
      {
        itemcode: 'P1',
        mediaitems: [
          {mimetype: 'text/plain', text: 'The cat sleeps in the sun.'},
          {mimetype: 'audio/wav', src: 'media/model-01.wav'},
        ],
      },
      MEDIA,
    );

    expect(parts.map((part) => part.kind)).toEqual(['text', 'audio']);
    expect(parts[0].text).toBe('The cat sleeps in the sun.');
    expect(parts[1].durationMs).toBe(1000);
  });

  it('flags a declared playback file the media list does not know (ui-spec §9)', () => {
    const parts = stageParts({mediaitems: [{mimetype: 'audio/wav', src: 'media/gone.wav'}]}, MEDIA);

    expect(parts).toEqual([{kind: 'audio-missing', text: 'media/gone.wav', src: 'media/gone.wav', durationMs: null}]);
  });

  it('flags an audio item that declares no file at all', () => {
    expect(stageParts({mediaitems: [{mimetype: 'audio/wav'}]}, MEDIA)).toEqual([
      {kind: 'audio-missing', text: '', src: null, durationMs: null},
    ]);
  });

  it('claims nothing when the media list could not be read', () => {
    const parts = stageParts({mediaitems: [{mimetype: 'audio/wav', src: 'media/gone.wav'}]}, null);

    expect(parts.map((part) => part.kind)).toEqual(['audio']);
    expect(parts[0].durationMs).toBeNull();
  });

  it('keeps an unknown clip length as unknown instead of zero', () => {
    const parts = stageParts({mediaitems: [{mimetype: 'audio/wav', src: 'media/unknown-length.wav'}]}, MEDIA);

    expect(parts[0].durationMs).toBeNull();
  });

  it('names the bank when the sound is a drawn item’s model recording', () => {
    const parts = stageParts(
      {mediaitems: [{mimetype: 'audio/wav', src: `${BANK_MOCK_SRC_PREFIX}std-passages`}]},
      MEDIA,
    );

    expect(parts).toEqual([{kind: 'bank-audio', text: 'std-passages', src: null, durationMs: null}]);
  });

  it('renders a prompt document through the library’s plain-text conversion', () => {
    const parts = stageParts(
      {
        mediaitems: [
          {
            mimetype: 'text/x-prompt',
            promptDoc: {body: {blocks: [{type: 'p', texts: [{type: 'text', text: 'A decorated prompt.'}]}]}},
          },
        ],
      },
      MEDIA,
    );

    expect(parts[0].kind).toBe('prompt');
    expect(parts[0].text).toBe('A decorated prompt.');
  });

  it('labels an image with its alt text and an unknown type with its mimetype', () => {
    const parts = stageParts(
      {
        mediaitems: [
          {mimetype: 'image/png', src: 'media/pic.png', alt: 'A cat'},
          {mimetype: 'video/mp4', src: 'media/clip.mp4'},
        ],
      },
      MEDIA,
    );

    expect(parts[0]).toEqual({kind: 'image', text: 'A cat', src: 'media/pic.png', durationMs: null});
    expect(parts[1].kind).toBe('unsupported');
    expect(parts[1].text).toBe('video/mp4');
  });

  it('treats a media item without a mimetype as text, the script default', () => {
    const parts = stageParts({mediaitems: [{text: 'Repeat the vowel after the model.'}]}, MEDIA);

    expect(parts).toEqual([{kind: 'text', text: 'Repeat the vowel after the model.', src: null, durationMs: null}]);
  });

  it('reduces an item’s prompt to one line for the order list', () => {
    const item: PromptItem = {
      mediaitems: [
        {mimetype: 'text/plain', text: 'Say the word.'},
        {mimetype: 'audio/wav', src: 'media/model-01.wav'},
        {mimetype: 'text/plain', text: 'Then wait.'},
      ],
    };

    expect(promptTextOf(item)).toBe('Say the word. Then wait.');
    expect(promptTextOf({mediaitems: [{mimetype: 'audio/wav', src: 'media/model-01.wav'}]})).toBe('');
    expect(promptTextOf(null)).toBe('');
  });

  it('shows nothing for an item with no media items', () => {
    expect(stageParts({mediaitems: []}, MEDIA)).toEqual([]);
    expect(stageParts(null, MEDIA)).toEqual([]);
  });
});
