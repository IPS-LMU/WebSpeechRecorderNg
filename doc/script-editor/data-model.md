# Script model: what exists, and what the editor adds

Single definition for both applications:
[projects/speechrecorderng/src/lib/speechrecorder/script/script.ts](../../projects/speechrecorderng/src/lib/speechrecorder/script/script.ts),
exported through
[public-api.ts](../../projects/speechrecorderng/src/public-api.ts). The editor must not keep its
own copy.

## 1. What the recorder honours today

Read this before designing anything: several fields in the current model are not what their names
suggest.

| Field | Reality in [sessionmanager.ts](../../projects/speechrecorderng/src/lib/speechrecorder/session/sessionmanager.ts) |
|---|---|
| `Section.mode` | `MANUAL`, `AUTOPROGRESS`, `AUTORECORDING` — all three implemented |
| `Section.promptphase` | `IDLE`, `PRERECORDING`, `RECORDING`, `PRERECORDINGONLY` — decides when the prompt becomes visible |
| `Section.order`, `Group.order` | only `RANDOM` shuffles; `SEQUENTIAL` is the default; **`RANDOMIZED` is in the type and ignored** — the shuffle runs in [speechrecorderng.component.ts](../../projects/speechrecorderng/src/lib/speechrecorderng.component.ts) |
| `Section.training` | items are excluded from the completeness check |
| `PromptItem.prerecdelay` | pre-recording delay; falls back to **`prerecording`** when unset; default 1000 ms |
| `PromptItem.postrecdelay` | post-recording delay; falls back to **`postrecording`** when unset; default 500 ms |
| `PromptItem.recduration` | recording length; the maximum timer is `pre + recduration + post`; unset means run until stopped |
| `PromptItem.type` | `'nonrecording'` shows the item without recording; anything else (including unset) records |
| `PromptItem.duration` | only used for `type: 'nonrecording'`, and only in `AUTORECORDING` sections |
| `PromptItem.mediaitems` | an array, but **only the first entry is used** |
| `Mediaitem` | `text`, `promptDoc` (formatted text), `src` + `mimetype` (image, audio, video), `alt`, `defaultVirtualViewBox` |
| `Script.virtualViewBox` | scales image prompts to a fixed virtual height |

Consequences for the editor: offer only `SEQUENTIAL` and `RANDOM`; show one delay field per side
and treat the legacy name as an alias to be fixed on request (D7); edit `mediaitems[0]` only.

## 2. Additions

### 2.1 Playback — what the speaker hears

```ts
export type PlaybackWhen = 'BEFORE' | 'PRERECORDING' | 'DURING' | 'ONDEMAND';

export interface Playback {
  /** Project-relative resource path, resolved like an image prompt's `src`. */
  src: string;
  mimetype?: string;
  /** Required by the editor: used for the item label and for speakers who cannot hear it. */
  alt?: string;
  when: PlaybackWhen;
  /** Times the clip is played back to back. Default 1. */
  repeats?: number;
  /** Silence between repeats, ms. Default 500. */
  gap?: number;
  /** Show a replay button on the stage. Default false. */
  replayable?: boolean;
  /** Cap on replays; unset means no cap. Counted in the session log. */
  maxReplays?: number;
  /** Ask the speaker to put on headphones before the section starts. */
  headphones?: boolean;
}

export interface PromptItem {
  // … existing fields …
  playback?: Playback;
  /** Set by the server on a drawn item; traces it back to its bank item. */
  bankItemId?: string;
}
```

`when` semantics, which the recorder implements in M1 and the editor's preview mirrors:

| Value | Behaviour |
|---|---|
| `BEFORE` | the clip plays to the end, then the pre-recording delay starts, then recording. The speaker cannot talk over it. |
| `PRERECORDING` | the clip plays inside the pre-recording delay. The delay should be at least `repeats × duration + (repeats − 1) × gap`; the editor warns when it is shorter (W05). |
| `DURING` | the clip plays while the microphone is open (shadowing, masking). Requires `headphones: true` or the loudspeaker is recorded (W03). |
| `ONDEMAND` | the stage shows a play button; the speaker decides when to listen. Implies `replayable`. |

Timing: `effectiveTiming(item)` in the library (see README §5) returns the playback span, the
pre-recording delay, the recording length and the post-recording delay, applying every fallback
in §1. Both the recorder's timers and the editor's timeline bar use it.

### 2.2 Draw — items chosen from a bank

A group holds **either** `promptItems` **or** a `draw` rule. In a published script a drawn group's
`promptItems` is an empty array; in a session's resolved script it holds the drawn items (§2.4).

```ts
export type DrawFixedBy = 'SESSION' | 'SPEAKER' | 'SCRIPT';
export type BankSource = 'PROJECT' | 'BUILTIN';

export interface DrawFilter {
  category?: string;
  /** Inclusive word-count range, e.g. [6, 12]. */
  words?: [number, number];
  /** Only items that carry a model recording. */
  hasAudio?: boolean;
  tags?: Array<string>;
}

export interface Draw {
  bank: string;
  bankSource: BankSource;
  filter?: DrawFilter;
  count: number;
  /** Order of the drawn items in the session. Default RANDOM. */
  order?: Order;
  fixedBy: DrawFixedBy;
  /** Skip items this speaker already recorded in this project. Default false. */
  skipRecordedBySpeaker?: boolean;
  /** Drawn itemcodes are `${itemcodePrefix}001` upwards. */
  itemcodePrefix: string;
  /** Play each drawn item's own model recording instead of one fixed file. */
  playBankAudio?: boolean;
  /** Playback settings applied to every drawn item when `playBankAudio` is set. */
  playback?: Omit<Playback, 'src' | 'mimetype' | 'alt'>;
  /** Timing applied to every drawn item. */
  itemDefaults?: Pick<PromptItem, 'prerecdelay' | 'recduration' | 'postrecdelay' | 'recinstructions'>;
}

export interface Group {
  order?: Order;
  draw?: Draw;
  promptItems: Array<PromptItem>;
  _shuffledPromptItems: Array<PromptItem>;
}
```

`fixedBy` decides what a draw is keyed to, which the server implements:

| Value | Meaning |
|---|---|
| `SESSION` | every session draws its own items. Covers a large bank. |
| `SPEAKER` | a returning speaker gets the same items again. Suits repeated measurements. |
| `SCRIPT` | one draw per script version; everyone recorded with that version gets the same items. |

### 2.3 Item banks

Banks are not part of a script. A script points at one.

```ts
export interface Bank {
  bankId: string;
  title: string;
  source: BankSource;
  /** Set for source PROJECT. */
  project?: string;
  itemCount: number;
  /** Application release a BUILTIN bank shipped with, e.g. "3.12". */
  shippedWith?: string;
  updated?: string;
}

export interface BankItem {
  bankItemId: string;
  /** Exactly one of text, promptDoc or src describes what is shown. */
  text?: string;
  promptDoc?: PromptDoc;
  src?: string;
  mimetype?: string;
  alt?: string;
  /** Model recording, played when the draw rule sets playBankAudio. */
  audioSrc?: string;
  audioMimetype?: string;
  /** Filterable metadata. */
  category?: string;
  words?: number;
  tags?: Array<string>;
}
```

A `BankItem` becomes a `PromptItem` at resolution: `text`/`promptDoc`/`src` move into
`mediaitems[0]`, `audioSrc` becomes `playback.src` when `playBankAudio` is set, `itemDefaults`
supply the timing, and `bankItemId` is carried for traceability.

### 2.4 Resolved draws

What the server stores with a session, and what the editor reads for the draw record view.

```ts
export interface ResolvedDrawItem {
  itemcode: string;
  bankItemId: string;
}

export interface ResolvedDraw {
  /** Position of the drawn group in the script. */
  sectionIdx: number;
  groupIdx: number;
  bank: string;
  bankSource: BankSource;
  drawnDate: string;
  /** Script version the draw was made against. */
  scriptVersion: number;
  items: Array<ResolvedDrawItem>;
}
```

The session's script, as served to the recorder, has the drawn group's `promptItems` filled in
and no `draw` key. That is why the recorder needs no change (D2).

### 2.5 Script metadata

```ts
export interface Script {
  type?: 'script';
  scriptId?: string | number;
  /** Human label for the library list. Server-side decision, see README §8.2. */
  name?: string;
  virtualViewBox?: VirtualViewBox;
  /** Lowest recorder version that understands every feature used here, e.g. "3.12". */
  minRecorderVersion?: string;
  sections: Array<Section>;
}
```

## 3. JSON examples

### 3.1 Prompt item that plays a model sentence, then records

```json
{
  "itemcode": "R0",
  "prerecdelay": 500,
  "recduration": 8000,
  "recinstructions": { "recinstructions": "Listen, then repeat the sentence." },
  "playback": {
    "src": "media/model-01.wav",
    "mimetype": "audio/wav",
    "alt": "Model sentence, male voice",
    "when": "BEFORE",
    "repeats": 1,
    "replayable": false,
    "headphones": true
  },
  "mediaitems": []
}
```

An empty `mediaitems` array means nothing is shown — the speaker answers from what was heard.
Older recorders must tolerate this; see §5.

### 3.2 Group drawn from a project bank

```json
{
  "order": "RANDOM",
  "draw": {
    "bank": "sv-sentences-v3",
    "bankSource": "PROJECT",
    "filter": { "category": "sentence", "words": [6, 12], "hasAudio": true },
    "count": 20,
    "fixedBy": "SESSION",
    "skipRecordedBySpeaker": true,
    "itemcodePrefix": "RB",
    "playBankAudio": true,
    "playback": { "when": "BEFORE", "repeats": 1, "headphones": true },
    "itemDefaults": { "prerecdelay": 500, "recduration": 8000 }
  },
  "promptItems": []
}
```

### 3.3 The same group inside a created session

```json
{
  "order": "RANDOM",
  "promptItems": [
    {
      "itemcode": "RB001",
      "bankItemId": "sv-0147",
      "prerecdelay": 500,
      "recduration": 8000,
      "playback": { "src": "bank/sv-sentences-v3/sv-0147.wav", "when": "BEFORE", "headphones": true },
      "mediaitems": [{ "text": "Hon målade köket ljusblått i somras." }]
    }
  ]
}
```

## 4. Invariants

The editor enforces these; the server must re-check them, because a client cannot be trusted.

1. `itemcode` is non-empty and unique across the whole script, drawn items included.
2. A drawn group reserves `${itemcodePrefix}001` … `${itemcodePrefix}NNN` for `count` items. No
   fixed item may use a code in that range, and two draw rules may not share a prefix.
3. A group has `draw` or a non-empty `promptItems`, never both.
4. `count` ≥ 1 and ≤ the number of items the filter matches, unless repeats are explicitly
   allowed (not offered in the UI today).
5. `playback.src` resolves to a readable project resource; `playback.when: 'DURING'` requires
   `headphones: true` to avoid recording the loudspeaker (warning, not an error — a researcher may
   want the bleed).
6. `type: 'nonrecording'` items never carry `recduration`; `duration` is meaningless elsewhere.
7. `mediaitems` holds at most one entry, because the recorder reads only the first.

## 5. Version handshake

Old recorders ignore unknown JSON keys, so a script using `playback` loaded by a pre-M1 recorder
runs without the clip and nobody is told. Prevent that:

- The editor sets `minRecorderVersion` on publish: the highest version required by any feature in
  the script (`playback` → the release that implements M1; `draw` is server-side and needs no
  recorder floor).
- The recorder compares `minRecorderVersion` with
  [spr.module.version.ts](../../projects/speechrecorderng/src/lib/spr.module.version.ts) at script
  load and refuses with a clear message rather than running a silently different session.
- The editor's checks panel raises N04 whenever an edit lifts the floor above the version the
  project's deployment reports.

## 6. Normalisation (D7)

Offered as one-click fixes in the checks panel, never applied on save:

| Found | Fix | Check |
|---|---|---|
| `prerecording` set, `prerecdelay` unset | rename to `prerecdelay` | N01 |
| `postrecording` set, `postrecdelay` unset | rename to `postrecdelay` | N01 |
| `order: "RANDOMIZED"` | replace with `RANDOM` or `SEQUENTIAL`, explicitly chosen | N02 |
| `mediaitems` longer than 1 | keep the first, move the rest to a new item or drop, explicitly chosen | W08 |

`normalise.ts` must be idempotent and must never touch a key it was not asked about: an imported
third-party script that nobody fixed comes back out byte-comparable except for key order.
