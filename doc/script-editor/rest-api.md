# REST API for the script editor

Every endpoint follows the conventions already in the library
([project.service.ts](../../projects/speechrecorderng/src/lib/speechrecorder/project/project.service.ts),
[session.service.ts](../../projects/speechrecorderng/src/lib/speechrecorder/session/session.service.ts)):

- Paths are relative to `{apiEndPoint}` from
  [spr.config.ts](../../projects/speechrecorderng/src/lib/spr.config.ts); empty by default, so the
  API sits beside the application.
- Editor requests carry `withCredentials` when the deployment sets it. Authentication is the
  server's, not the application's: the editor ships no login UI and treats 401 as "go to the
  deployment's login" and 403 as "you may read but not change this".
- Writes are protected the deployment's way: a session cookie with the deployment's CSRF scheme
  (the XSRF cookie/header Angular already supports) or a bearer token. `401` redirects to the
  deployment's login with a return URL; the editor never renders a login form.
- Project-scoped resources live under `project/{projectId}/…`, as sessions and recording files
  already do.
- `Content-Type: application/json` unless stated otherwise.
- In development, `ApiType.FILES` appends `.json?requestUUID=…` to GETs; write endpoints are
  unavailable in that mode and the editor shows its draft as locally modified.

Error body for every 4xx and 5xx:

```json
{"error":"The draft changed since you loaded it.","message":"The draft changed since you loaded it.","code":"SCRIPT_DRAFT_CONFLICT","details":{"current":{"scriptId":1245},"currentEtag":"\"4c1f…\""}}
```

`error` keeps the human message, because that is the only field the recorder client reads; `code` is
the machine-readable selector the editor switches on, and `details` carries what a caller needs to
recover. Both are omitted when absent, so the body stays additive over the original `{error}` shape.
The receiver implements this in `respondToError` (`server/api.mjs`).

The reference implementation is the repository's receiver ([server/](../../server), `npm run
serve:api`) — the draft of the production server, so this file and the store layout are contracts
and changes are transferred ([implementation-plan.md](implementation-plan.md) §10.1). It already
speaks the recorder's read and upload subset; the editor endpoints in this file are the amendment
(track R of the plan).

## 1. What must not change

`GET {apiEndPoint}script/{scriptId}` keeps working exactly as today
([script.service.ts](../../projects/speechrecorderng/src/lib/speechrecorder/script/script.service.ts)):
it returns the **latest published version** of the script, with drawn groups left unresolved. The
recorder never sees a draft. Sessions do **not** read this unresolved form: at creation the server
materialises the resolved script and stores its id in `Session.script`, so the recorder's existing
`GET script/{sess.script}` returns plain items ([data-model.md](data-model.md) §2.4). The
alternative — a session-scoped script endpoint plus one changed call site in the recorder — is an
M0 decision; the materialised id is the plan's default.

### 1.1 Deployment version

```
GET {api}version  ->  200 {"recorderVersion":"3.11.26"}
```

What the deployment serves, for the checks that compare against it: W10 ("the deployment runs
{actual}") and N04 (an edit that lifts `minRecorderVersion`). Because the receiver and the recorder
are co-deployed, the value is the receiver's truth (`--recorder-version`, default
`RECORDER_VERSION`), not the editor's own build. The same value gates session creation
(§4.1).

### 1.2 Write concurrency for banks and media

Scripts and drafts are ETag-protected (§2.3). Banks and media are not: a bank edit or a media
`DELETE` is last-write-wins, and the editor re-reads the resource after a successful write. Media is
the exception that matters — a `DELETE` refuses with `409 MEDIA_IN_USE` while a **published**
script references the file, so a reference cannot be pulled out from under a runnable version (§5).

## 2. Scripts

### 2.1 List

```
GET project/{projectId}/script
```

```json
[
  {
    "scriptId": "1245",
    "name": "Repetition and read speech",
    "status": "DRAFT",
    "publishedVersion": 3,
    "draftVersion": 4,
    "sections": 5,
    "fixedItems": 22,
    "drawnItems": 20,
    "sessions": { "total": 14, "started": 9, "byVersion": { "3": 14 } },
    "modified": "2026-09-30T09:12:00Z",
    "modifiedBy": "nylen",
    "archived": false
  }
]
```

`status` is `DRAFT` when a draft differs from the published version, `PUBLISHED` when they match,
`ARCHIVED` when retired. Drives the library list and its filter (ui-spec §2).

### 2.2 Create

```
POST project/{projectId}/script
{ "name": "Repetition and read speech", "from": { "scriptId": "1250", "version": 2 } }
```

`from` is optional and duplicates an existing script into a new draft. A create with no body seeds
a minimal valid script (one section, one group, one item) so E10 cannot block the first publish.
Create, duplicate and Import JSON always assign a new `scriptId`; a `scriptId` in the body is
ignored. Responds `201` with `Location: project/{projectId}/script/{newId}/draft`, the draft body
and its `ETag`, so the editor can write without an extra GET.

### 2.3 Read and write the draft

```
GET project/{projectId}/script/{scriptId}/draft      → 200, ETag: "4-17"
PUT project/{projectId}/script/{scriptId}/draft      If-Match: "4-17"
```

The validator is **strong** (`"4-17"`, not `W/"4-17"`): RFC 7232 forbids a weak validator in
`If-Match`. It covers the stored bytes, so the server stores the draft as received without
canonicalising it — unknown keys and their order survive round trips. An identical `PUT` is
idempotent and returns the same `ETag`; a changed body returns the new one.

The body is a `Script` ([data-model.md](data-model.md) §2.5). `PUT` without `If-Match` is rejected
with `428`; a stale `If-Match` returns `412` with the current draft **and its `ETag`** in
`details.current`, which the editor uses to show a conflict and re-apply the pending edit once.

Autosave: the editor debounces writes (2 s idle, or on blur of a field) and sends the whole draft.
Partial `PATCH` is deliberately not specified — a script is small and whole-document writes keep
the server simple and the conflict story honest.

### 2.4 Publish

```
POST project/{projectId}/script/{scriptId}/publish
{ "fromDraftEtag": "4-17", "note": "added the repetition section" }
```

`201` with `{ "version": 4, "publishedDate": "…", "minRecorderVersion": "3.12" }`.

The server re-runs the invariants in [data-model.md](data-model.md) §4 and the error-severity
checks in [validation.md](validation.md). Any failure returns `409` with
`details.checks: [{"id":"E02","path":"sections[2].groups[0].promptItems[1].itemcode"}]`.
Warnings never block.

`minRecorderVersion` is the highest floor of the features the script uses
([data-model.md](data-model.md) §5). A script using a feature the server has no floor for is refused
with `409 FEATURE_FLOOR_UNKNOWN` and `details.features: ["…"]`: shipping it would make a recorder
skip the feature silently.

The server enforces every error-severity id the editor shows, with the same ids, and recomputes
`E04`'s `matchCount` atomically at publish time — a count that passed in the editor can still be
refused if the bank changed. The editor renders returned `details.checks` in its own panel, not as
a bare error.

Publishing never touches running sessions: they keep the version they were created with.

### 2.5 Versions

```
GET project/{projectId}/script/{scriptId}/version                → list
GET project/{projectId}/script/{scriptId}/version/{n}            → one Script
POST project/{projectId}/script/{scriptId}/draft/_restore        { "version": 3 }
```

```json
[{ "version": 3, "publishedDate": "…", "publishedBy": "nylen", "note": "", "sessions": 14 }]
```

`_restore` copies version `n` into the draft — a new draft, not a publish. It replaces the current
draft, so it requires `If-Match`, and responds with the new draft and its `ETag`; published
versions are untouched.

### 2.6 Metadata

```
PATCH project/{projectId}/script/{scriptId}
{ "name": "Read speech, adults", "archived": true }
```

## 3. Item banks

A bank list mixes the project's own banks and the read-only banks that ship with the application
(D3). The editor distinguishes them by `source`, never by name.

### 3.1 List

```
GET project/{projectId}/bank
```

```json
[
  { "bankId": "sv-sentences-v3", "title": "Swedish sentences v3", "source": "PROJECT",
    "project": "my-project", "itemCount": 412, "updated": "2026-09-01T10:00:00Z" },
  { "bankId": "std-passages", "title": "Standard passages and vowels", "source": "BUILTIN",
    "itemCount": 24, "shippedWith": "3.12" }
]
```

### 3.2 Query items

```
GET project/{projectId}/bank/{bankId}/item
      ?category=sentence&minWords=6&maxWords=12&hasAudio=true&tag=balanced
      &q=free+text&limit=50&offset=0
```

```json
{
  "matchCount": 412,
  "withoutAudio": 37,
  "offset": 0,
  "items": [
    { "bankItemId": "sv-0142", "text": "Han satte sig på bänken vid stationen.",
      "category": "sentence", "words": 7, "tags": ["balanced"],
      "audioSrc": "bank/sv-sentences-v3/sv-0142.wav", "audioMimetype": "audio/wav",
      "usedInSessions": 86 }
  ]
}
```

`matchCount` is what the draw rule validates `count` against (E04), and `withoutAudio` is what
raises W04 when the rule sets `playBankAudio`. `usedInSessions` is optional; omit it if counting
is expensive, and the UI hides the column.

Filter semantics are frozen ([data-model.md](data-model.md) §2.2): `tag` is repeatable and
ANDed; `hasAudio=false` selects items **without** a model recording; `minWords`/`maxWords` are
inclusive; `category` is an exact match; `q` is a case-insensitive substring over the item text.
`Draw.filterVersion` pins these semantics so a later change cannot reinterpret an old rule.

### 3.3 Edit a project bank

```
POST   project/{projectId}/bank                      { "title": "…" }  |  { "copyFrom": "std-passages" }
POST   project/{projectId}/bank/{bankId}/item        one BankItem or an array
PUT    project/{projectId}/bank/{bankId}/item/{id}
DELETE project/{projectId}/bank/{bankId}/item/{id}
POST   project/{projectId}/bank/{bankId}/_import     Content-Type: text/csv
```

Every write against a `BUILTIN` bank returns `405` with `error: "BANK_READ_ONLY"`. `copyFrom`
with a builtin id is how a researcher gets an editable copy, and the copy records
`{ "copiedFrom": "std-passages", "copiedFromRelease": "3.12" }`.

Bank writes carry no validator: concurrent edits to one bank are last-write-wins, and the editor
reloads the bank after each write. (An `ETag` per bank is an M0 option.)

CSV import columns: `text,category,words,tags,audio` — `audio` naming a file in a multipart part
or an already-uploaded project resource. Respond `200` with
`{ "imported": 120, "skipped": 3, "errors": [{ "line": 44, "message": "…" }] }`.

### 3.4 Bank media

A bank item's model recording is a project resource, fetched like any other
(`projectResourceUrl` already exists in `ProjectService`). For builtin banks the server resolves
the path into whatever it ships with; the client only ever uses the `audioSrc` it was given.

## 4. Draw resolution and the draw record

### 4.1 At session creation (server behaviour, not an editor call)

A session whose script carries a `minRecorderVersion` above the version the receiver serves
([data-model.md](data-model.md) §5) is refused with `409 RECORDER_VERSION_TOO_OLD` and
`details: {"required":"…","actual":"…"}` — the recorder bundle in the operator's browser may be
stale, so the server is the one that checks. `--recorder-version` sets the version the receiver
reports (default: the bundled recorder's).

When a session is created against a script version, the server, for each group that has a `draw`:

1. Applies `filter` to the bank, and removes items this speaker already recorded in this project
   when `skipRecordedBySpeaker` is set. When that leaves fewer than `count`, it refills from the
   skipped set, newest-recorded last, and records in the `ResolvedDraw` that it had to.
2. Picks `count` items without repeats, keyed by `fixedBy`: a session-specific seed, a
   speaker-stable seed, or a script-version-stable seed. Seeds come from a documented,
   deterministic PRNG the server implements (the editor never resolves a session draw), so the same
   session and `fixedBy` reproduce the same items.
3. Materialises prompt items ([data-model.md](data-model.md) §2.4): itemcodes from
   `itemcodePrefix` (padding and count cap in data-model §4), media from the bank item,
   `playback` from `draw.playback` plus the item's `audioSrc` when `playBankAudio` is set, timing
   from `itemDefaults`, and `bankItemId` carried through. `order: "RANDOM"` shuffles once here;
   `SEQUENTIAL` keeps the order the filter returned.
4. **Materialises the resolved script** — the drawn group's `promptItems` filled in, no `draw` key
   — stores it and points `Session.script` at its id. The recorder's existing
   `GET script/{sess.script}` therefore returns plain items and needs no call-site change.
   Materialised scripts are internal: the library list and the draw record exclude them from their
   default listings.
5. Stores a `ResolvedDraw`-style record per drawn source in the session trace — the shipped
   `Session.prefills` for list sources plus `Session.bankDraws` for bank sources (data-model §2.4).
   Materialised scripts are internal: the library list and the script-scope record exclude them.
   `GET …/draws` merges the trace for the record view; `POST …/draws/_redraw` re-resolves from the
   **original** script id (`session.scriptSource`) while the session is `CREATED`.

From then on the session is a plain script with plain items; re-opening it never reshuffles (D2).
Preview sessions (`type: "TEST"`, §6) resolve draws the same way but are excluded from reports,
usage counts and the draw record's default listing.

### 4.2 Read the record

```
GET project/{projectId}/session/{sessionId}/draws       → the session trace (prefills + bankDraws)
GET project/{projectId}/script/{scriptId}/draws?version=3&limit=50&offset=0
```

Preview (`type: "TEST"`) sessions are omitted from the default listing; `?includePreview=true`
shows them.

The script-scoped form powers the draw record view (ui-spec §7):

```json
{
  "total": 14,
  "rows": [
    { "sessionId": "2042", "speaker": "sp-13", "status": "STARTED", "scriptVersion": 3,
      "drawnDate": "…", "bank": "sv-sentences-v3", "bankSource": "PROJECT",
      "drawn": 20, "recorded": 11,
      "items": [{ "itemcode": "RB001", "bankItemId": "sv-0151", "recorded": true }] }
  ]
}
```

With `Accept: text/csv` the same URL returns one row per drawn item
(`sessionId,speaker,itemcode,bankItemId,recorded`), which is what researchers need for analysis.

### 4.3 Re-draw

```
POST project/{projectId}/session/{sessionId}/draws/_redraw
```

`200` with the new `ResolvedDraw[]` when the session status is `CREATED`. Any other status returns
`409` with `error: "SESSION_ALREADY_STARTED"`. The editor shows this as a disabled action with the
reason, rather than letting the request fail.

## 5. Media for playback

Playback files are project resources, so they travel the same path as image prompts:

```
POST project/{projectId}/media
Content-Type: audio/wav | video/mp4 | …
X-Filename: model-01.wav
```

`201` with `{ "src": "media/model-01.wav", "mimetype": "audio/wav", "durationMs": 4200, "bytes": 134 }`.

`durationMs` matters: the editor needs it for the timeline and for W05 (a clip longer than the
pre-recording delay). If the server cannot measure it, the editor decodes the file client-side on
upload and sends it back in the draft, and the field is documented as advisory.

`GET` uses the existing project resource path, so no new fetch mechanism appears in the recorder.

GET project/{projectId}/media                                          → list
[{"src":"media/model-01.wav","mimetype":"audio/wav","durationMs":4200,"bytes":134,
  "usedBy":[{"scriptId":"1245","version":3}]}]

DELETE project/{projectId}/media/media/model-01.wav

`GET` returns the project's media with `usedBy` — the draft and published versions referencing it —
so the editor can offer a picker and check W11. `DELETE` is refused with `409` and
`error: "MEDIA_IN_USE"` while any **published** version references the file; a draft-only
reference does not block but is listed in the refusal body. Uploads are immediate and outside the
draft's undo stack, so the editor warns while a newly uploaded file is unreferenced; orphans are
harmless and cleared by a deployment job outside this feature.

`usedBy` entries are `{scriptId, version: n}` for a published version and `{scriptId, draft: true}`
for a draft. An upload carries `X-Filename`, or a filename in the multipart part; the stored name is
the basename, so a path cannot escape the media directory. Uploading under a name a published
version references is refused like a delete, so a session's clip cannot be swapped underneath it;
otherwise the upload replaces the file. The receiver measures `durationMs` for WAVE (`probeWav`) and
reports `null` for other types; the measured metadata lives in `<data>/project/{p}/media/index.json`,
which is an implementation detail and not part of the API.

## 6. Preview sessions (tier 2 dry run)

```
POST project/{projectId}/script/{scriptId}/preview-session
{ "version": "draft" }
```

`201` with `{"sessionId":"preview-9f2c","expires":"…"}`. The session has
`type: "TEST"`, resolves draws like any other session, and its recordings are discarded. The
editor opens the recorder application at `/wsr/ng/spr/session/preview-9f2c` in a new tab. The
recorder honours `session.type === "TEST"` by disabling uploads in that tab; where a cached older
build cannot, the deployment serving the preview must set `enableUploadRecordings: false`, so
nothing can reach storage even if the server forgets. Preview sessions are excluded from reports,
usage counts and the draw record's default listing, and expire at `expires`.

This is the only endpoint that lets the editor exercise a draft through the real recorder. Without
it, tier-2 preview cannot exist and only the editor-side mock remains.

## 7. Summary table

| Method | Path | Purpose | Milestone |
|---|---|---|---|
| GET | `version` | recorder version the deployment serves (W10/N04, session gate) | M2 |
| GET | `script/{id}` | published script; a session's script is a materialised id (see §4.1) | — |
| GET | `project/{p}/script` | library list | M2 |
| POST | `project/{p}/script` | create or duplicate | M3 |
| GET/PUT | `project/{p}/script/{id}/draft` | read and autosave the draft, ETag | M3 |
| POST | `project/{p}/script/{id}/publish` | freeze a version, error gate | M3 |
| GET | `project/{p}/script/{id}/version[/{n}]` | history, restore source | M3 |
| PATCH | `project/{p}/script/{id}` | name, archive | M3 |
| GET | `project/{p}/bank` | banks, project and builtin | M4 |
| GET | `project/{p}/bank/{b}/item` | filtered items, `matchCount` | M4 |
| POST/PUT/DELETE | `project/{p}/bank[/{b}/item…]` | project banks only | M4 |
| GET | `project/{p}/session/{s}/draws` | the session trace (prefills + bankDraws) | M4 |
| GET | `project/{p}/script/{id}/draws` | draw record, CSV | M4 |
| POST | `project/{p}/session/{s}/draws/_redraw` | unstarted sessions only | M4 |
| POST | `project/{p}/media` | upload a playback clip | M3 |
| GET | `project/{p}/media` | media list with `usedBy` | M3 |
| DELETE | `project/{p}/media/{src}` | refused while published versions reference it | M3 |
| POST | `project/{p}/script/{id}/preview-session` | tier-2 dry run | M4 |
