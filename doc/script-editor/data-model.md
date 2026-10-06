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
and treat the legacy name as an alias to be fixed on request (D7); edit `mediaitems[0]` only. A
section that predates `groups` and carries `promptUnits` is a legacy tree shape: the editor
detects it, opens read-only, and migrates only on request (N06).

## 2. Additions

### 2.1 Playback — what the speaker hears

The sound source is the item's **first audio mediaitem**. Upstream plays it as the prompt
(`Mediaitem.autoplay`), holds the traffic light for it and lets the operator repeat it
(`Mediaitem.replay`; control and `R` key, `audio/prompt_audio.ts`). Per **D-V = C** the editor adds
an optional **modifier** on the item: when present it takes over placement, repeats and the replay
rule; when absent, the shipped mediaitem flags keep their meaning. The file, `mimetype` and `alt`
stay on the mediaitem — `alt` is what screen readers and item labels use.

```ts
export type PlaybackWhen =
  | 'WITH_PROMPT'   // default — the shipped autoplay behaviour
  | 'BEFORE'
  | 'PRERECORDING'
  | 'DURING'
  | 'ONDEMAND';

export interface Playback {
  /** Where the prompt's audio plays. Default 'WITH_PROMPT'. */
  when?: PlaybackWhen;
  /** Times the clip is played back to back. Default 1. */
  repeats?: number;
  /** Silence between repeats, ms. Default 500. */
  gap?: number;
  /** Overrides `Mediaitem.replay` when present. */
  replayable?: boolean;
  /** Cap on replays; unset means no cap. Counted in the session log. */
  maxReplays?: number;
  /** Ask the speaker to put on headphones before the section starts. */
  headphones?: boolean;
  /** Advisory clip length in ms; the server measures it on upload and the timeline/W05 prefer it. */
  durationMs?: number;
}

export interface PromptItem {
  // … existing fields …
  playback?: Playback;
  /** Set by the server on an item drawn from a bank; traces it to its bank item. */
  bankItemId?: string;
}
```

Rules, frozen in M0: `playback` present ⇒ the item's `Mediaitem.autoplay`/`replay` are ignored, and
a check flags an item that sets both (so the intent is explicit).

`when` semantics, which the recorder implements in M1 and the editor's preview mirrors:

| Value | Behaviour |
|---|---|
| `WITH_PROMPT` | **Default.** The audio plays when the prompt is presented and the traffic light waits for it — today's `prompt_audio.ts` behaviour. |
| `BEFORE` | the clip plays to the end, then the pre-recording delay starts, then recording. The speaker cannot talk over it. |
| `PRERECORDING` | the clip plays inside the pre-recording delay. The delay should be at least `repeats × duration + (repeats − 1) × gap`; the editor warns when it is shorter (W05). |
| `DURING` | the clip plays while the microphone is open (shadowing, masking). Requires `headphones: true` or the loudspeaker is recorded (W03). |
| `ONDEMAND` | the stage shows a play button; the speaker decides when to listen. Implies `replayable`. |

On a `type: 'nonrecording'` item only `WITH_PROMPT`, `BEFORE` and `ONDEMAND` are meaningful;
`PRERECORDING` and `DURING` have no phase to attach to and the editor warns (W12). The item's
`duration` governs when the next item starts, not the clip.

Timing: `effectiveTiming(item)` in the library (see README §5) returns the playback span, the
pre-recording delay, the recording length and the post-recording delay, applying every fallback
in §1. Both the recorder's timers and the editor's timeline bar use it.

### 2.2 Randomised items — list and bank sources (D-W)

Upstream ships **prefill**: a placeholder prompt item (`PromptItem.prefill`) is replaced, when the
script loads, by one generated item per entry of the chosen list source (`source` fetched from
`script/{source}`, `select:'random'`, `itemcodeFormat` with `{n}`, `mediaitems` templated with
`{entry}`); the choice is stored in `Session.prefills` so a reload reproduces the items. Per
**D-W = A** the item bank is the **second source type of the same mechanism**, not a parallel draw
system: a script has one way to randomise items.

A **bank source** carries the fields below (the former `Draw`), and resolution is split:

- **list sources** stay client-side at load — the shipped `ScriptPrefillService` path, unchanged;
- **bank sources**, and anything needing speaker or recording state, resolve **server-side at
  session creation**: the server picks the items, materialises the session's script (§2.4, D-K) and
  appends the draw to the **unified session trace** (extended `Session.prefills`; the former
  `ResolvedDraw` is dropped).

**Frozen schema (M0).** A placeholder prompt item references exactly one source: the shipped
`source` (a script-resource list) or the new `bank`:

```ts
export interface PrefillBankSource {
  bank: string;
  bankSource: BankSource;
  filter?: DrawFilter;
  filterVersion?: number;
  count: number;                      // 1…999
  order?: Order;                      // default RANDOM: shuffled once, at resolution
  fixedBy?: DrawFixedBy;              // default SESSION
  skipRecordedBySpeaker?: boolean;
  itemcodePrefix: string;             // generated codes are `${prefix}001`, zero-padded
  playBankAudio?: boolean;
  playback?: Omit<Playback, 'replayable' | 'maxReplays' | 'durationMs'>;
  itemDefaults?: Pick<PromptItem, 'prerecdelay' | 'recduration' | 'postrecdelay' | 'recinstructions'>;
}

export interface PromptItemPrefill {
  source?: string;                    // list source — exactly one of source/bank
  bank?: PrefillBankSource;
  select?: 'random';                  // list sources
  itemcodeFormat?: string;            // list sources (`{n}`)
  recinstructions?: string;
  mediaitems?: Array<Mediaitem>;
}
```

A bank source is resolved **once, at session creation**: each chosen bank item becomes a prompt item —
`itemcode` from the prefix, the bank item's `text`/`promptDoc`/`src` as `mediaitems[0]`, its model
recording appended when `playBankAudio` is set, `bankItemId` carried, timing from `itemDefaults`.
The seed is what `fixedBy` names — the session, the speaker, or the script version; `SPEAKER`
without a session speaker falls back to the session seed, and the trace records that it did.
`skipRecordedBySpeaker` removes what the speaker already recorded and refills from the skipped items,
recording that it did.

```ts
export type DrawFixedBy = 'SESSION' | 'SPEAKER' | 'SCRIPT';
export type BankSource = 'PROJECT' | 'BUILTIN';

export interface DrawFilter {
  category?: string;
  /** Inclusive word-count range, e.g. [6, 12]. */
  words?: [number, number];
  /** true = only items with a model recording, false = only items without, absent = either. */
  hasAudio?: boolean;
  /** Free-text, case-insensitive substring over `text` and `promptDoc`'s plain text. */
  q?: string;
  /** All listed tags must be present (AND). */
  tags?: Array<string>;
}

/** The bank source descriptor. Referenced from a placeholder item's `prefill` (D-W) — the descriptor
    itself sits at `promptItems[n].prefill.bank`, which is the shape `drawnSource()` returns; M0
    freezes the exact discriminated shape. */
export interface Draw {
  bank: string;
  bankSource: BankSource;
  filter?: DrawFilter;
  /** Pins the filter semantics in §2.2; absent means version 1. */
  filterVersion?: number;
  count: number;
  /** Order of the drawn items. Default RANDOM: shuffled once at creation. SEQUENTIAL keeps the
      order the filter returned. */
  order?: Order;
  fixedBy: DrawFixedBy;
  /** Skip items this speaker already recorded in this project. Default false. */
  skipRecordedBySpeaker?: boolean;
  /** Drawn itemcodes are `${itemcodePrefix}001`, zero-padded to three digits; `count` ≤ 999. */
  itemcodePrefix: string;
  /** Play each drawn item's own model recording instead of one fixed file. */
  playBankAudio?: boolean;
  /** Applied to every drawn item; the sound is the bank item's own model recording. */
  playback?: Omit<Playback, 'replayable' | 'maxReplays' | 'durationMs'>;
  /** Timing applied to every drawn item. */
  itemDefaults?: Pick<PromptItem, 'prerecdelay' | 'recduration' | 'postrecdelay' | 'recinstructions'>;
}

export interface Group {
  order?: Order;
  /** Superseded by D-W: a bank source is referenced from the placeholder item's `prefill`; M0
      freezes the exact discriminated shape. */
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

Filter semantics are frozen: `tags` are ANDed, `hasAudio: false` means items **without** a model
recording, `words` bounds are inclusive, `category` is exact and `q` is a case-insensitive
substring; `filterVersion` pins them so a later change cannot reinterpret an old rule. Resolution
is deterministic — a documented PRNG seeds the draw, so re-drawing the same session, or resolving
with a stable `fixedBy`, reproduces the items. `order: "RANDOM"` shuffles once at creation;
`SEQUENTIAL` keeps the filter's order. The editor's example draw is labelled as such and never
claims to be the session's draw.

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
  /** Model recording, played when the bank source sets `playBankAudio`. */
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

### 2.4 The session trace

What the server writes when a session is created, and what the editor reads for the record view.

Materialisation is unchanged: the server builds a plain script for the session (the drawn items in
place, no bank-source key) and points `Session.script` at its id, so the recorder's existing
`GET script/{sess.script}` returns plain items and needs no call-site change. Materialised scripts
are internal: the library list and the record view exclude them from their default listings.

The trace lives on the session: the shipped `Session.prefills` (upstream's `PrefillChoices`) for
list sources, plus **`Session.bankDraws`** for bank sources — one entry per placeholder itemcode with
`bank`, `bankSource`, `filter`, `count`, `fixedBy`, `key`, `itemcodePrefix`, the chosen
`{itemcode, bankItemId}` pairs, `refilled`, `skippedRecorded`, `speakerFallback` and
`drawnForVersion`. `GET …/draws` (session and script scope) merges both for the record view; the
former `ResolvedDraw` type is dropped. The exact shape is frozen in M0.

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
8. Playback numbers are sane: `repeats` ≥ 1, `gap` ≥ 0, `maxReplays` ≥ 0, and every virtual view
   box height is > 0.
9. `playback.when` on a `type: 'nonrecording'` item is only `BEFORE` or `ONDEMAND`.
10. A section with legacy `promptUnits` and no `groups` is never written back with an added
    `groups: []`; it migrates explicitly (N06) or stays read-only.

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
- The server applies the same comparison when a session is created: a recorder bundle cached in a
  browser cannot be trusted to check anything. Materialised session scripts (§2.4) carry the same
  floor as the script they came from.

Implemented (milestone L4):

- The table and the arithmetic live in
  [feature-versions.ts](../../projects/speechrecorderng/src/lib/speechrecorder/script/feature-versions.ts):
  `FEATURE_VERSIONS`, `compareVersions` (numeric segments, missing segments, pre-release), and
  `supportsRecorderVersion`. `playback` maps to the version this build reports, so the floor rises
  automatically with the release that ships the modifier.
- `sessionmanager`'s component refuses at script load with `spr.status.scriptVersionTooOld`.
- The receiver keeps its own copy in [server/feature-versions.mjs](../../server/feature-versions.mjs)
  and refuses a session whose script floor is above the version it serves
  (`--recorder-version`, default `RECORDER_VERSION`), with `409 RECORDER_VERSION_TOO_OLD`. A publish
  whose script uses a feature with no table entry is refused rather than shipped
  (`409 FEATURE_FLOOR_UNKNOWN`). The two copies are held to the same cases by
  `feature-versions.spec.ts` and `server/feature-versions.test.mjs`.

## 6. Normalisation (D7)

Offered as one-click fixes in the checks panel, never applied on save:

| Found | Fix | Check |
|---|---|---|
| `prerecording` set, `prerecdelay` unset | rename to `prerecdelay` | N01 |
| `postrecording` set, `postrecdelay` unset | rename to `postrecdelay` | N01 |
| `order: "RANDOMIZED"` | replace with `RANDOM` or `SEQUENTIAL`, explicitly chosen | N02 |
| section has `promptUnits` and no `groups` | convert to `groups`, explicitly chosen | N06 |
| `mediaitems` longer than 1 | keep the first, move the rest to a new item or drop, explicitly chosen | W08 |

`normalise.ts` must be idempotent and must never touch a key it was not asked about: an imported
third-party script that nobody fixed comes back out byte-comparable except for key order.
