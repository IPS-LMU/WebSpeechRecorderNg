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
- Project-scoped resources live under `project/{projectId}/…`, as sessions and recording files
  already do.
- `Content-Type: application/json` unless stated otherwise.
- In development, `ApiType.FILES` appends `.json?requestUUID=…` to GETs; write endpoints are
  unavailable in that mode and the editor shows its draft as locally modified.

Error body for every 4xx and 5xx:

```json
{ "error": "SCRIPT_DRAFT_CONFLICT", "message": "The draft changed since you loaded it.", "details": {} }
```

## 1. What must not change

`GET {apiEndPoint}script/{scriptId}` keeps working exactly as today
([script.service.ts](../../projects/speechrecorderng/src/lib/speechrecorder/script/script.service.ts)):
it returns the **latest published version** of the script, with drawn groups left unresolved. The
recorder never sees a draft. Sessions reference scripts as they already do.

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

`from` is optional and duplicates an existing script into a new draft. Responds `201` with
`Location: project/{projectId}/script/{newId}/draft` and the draft body.

### 2.3 Read and write the draft

```
GET project/{projectId}/script/{scriptId}/draft      → 200, ETag: "w/4-17"
PUT project/{projectId}/script/{scriptId}/draft      If-Match: "w/4-17"
```

The body is a `Script` ([data-model.md](data-model.md) §2.5). `PUT` without `If-Match` is rejected
with `428`; a stale `If-Match` returns `412` with the current draft in `details.current`, which the
editor uses to show a conflict and re-apply the pending edit once.

Autosave: the editor debounces writes (2 s idle, or on blur of a field) and sends the whole draft.
Partial `PATCH` is deliberately not specified — a script is small and whole-document writes keep
the server simple and the conflict story honest.

### 2.4 Publish

```
POST project/{projectId}/script/{scriptId}/publish
{ "fromDraftEtag": "w/4-17", "note": "added the repetition section" }
```

`201` with `{ "version": 4, "publishedDate": "…", "minRecorderVersion": "3.12" }`.

The server re-runs the invariants in [data-model.md](data-model.md) §4 and the error-severity
checks in [validation.md](validation.md). Any failure returns `409` with
`details.checks: [{ "id": "E02", "path": "sections[2].groups[0].promptItems[1].itemcode" }]`.
Warnings never block.

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

CSV import columns: `text,category,words,tags,audio` — `audio` naming a file in a multipart part
or an already-uploaded project resource. Respond `200` with
`{ "imported": 120, "skipped": 3, "errors": [{ "line": 44, "message": "…" }] }`.

### 3.4 Bank media

A bank item's model recording is a project resource, fetched like any other
(`projectResourceUrl` already exists in `ProjectService`). For builtin banks the server resolves
the path into whatever it ships with; the client only ever uses the `audioSrc` it was given.

## 4. Draw resolution and the draw record

### 4.1 At session creation (server behaviour, not an editor call)

When a session is created against a script version, the server, for each group that has a `draw`:

1. Applies `filter` to the bank, and removes items this speaker already recorded in this project
   when `skipRecordedBySpeaker` is set. When that leaves fewer than `count`, it refills from the
   skipped set, newest-recorded last, and records that it had to.
2. Picks `count` items without repeats, keyed by `fixedBy`: a session-specific seed, a
   speaker-stable seed, or a script-version-stable seed.
3. Materialises prompt items ([data-model.md](data-model.md) §2.4): itemcodes from
   `itemcodePrefix`, media from the bank item, `playback` from `draw.playback` plus the item's
   `audioSrc` when `playBankAudio` is set, timing from `itemDefaults`, and `bankItemId` carried
   through.
4. Stores the resolved script with the session and a `ResolvedDraw` record per drawn group.

From then on the session is a plain script with plain items. `GET session/{id}` and the script the
recorder loads show the resolved form, which is why the recorder needs no change (D2).

### 4.2 Read the record

```
GET project/{projectId}/session/{sessionId}/draw        → ResolvedDraw[]
GET project/{projectId}/script/{scriptId}/draw?version=3&limit=50&offset=0
```

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
POST project/{projectId}/session/{sessionId}/draw/_redraw
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
Deleting a file that a published version references must be refused (`409`,
`error: "MEDIA_IN_USE"`).

## 6. Preview sessions (tier 2 dry run)

```
POST project/{projectId}/script/{scriptId}/preview-session
{ "version": "draft" }
```

`201` with `{ "sessionId": "preview-9f2c", "expires": "…" }`. The session has
`type: "TEST"`, is excluded from every report, resolves draws like any other session, and its
recordings are discarded. The editor opens the recorder application at
`/wsr/ng/spr/session/preview-9f2c` in a new tab; that deployment is configured with
`enableUploadRecordings: false`, so nothing can reach storage even if the server forgets.

This is the only endpoint that lets the editor exercise a draft through the real recorder. Without
it, tier-2 preview cannot exist and only the editor-side mock remains.

## 7. Summary table

| Method | Path | Purpose | Milestone |
|---|---|---|---|
| GET | `script/{id}` | unchanged, recorder reads published | — |
| GET | `project/{p}/script` | library list | M2 |
| POST | `project/{p}/script` | create or duplicate | M3 |
| GET/PUT | `project/{p}/script/{id}/draft` | read and autosave the draft, ETag | M3 |
| POST | `project/{p}/script/{id}/publish` | freeze a version, error gate | M3 |
| GET | `project/{p}/script/{id}/version[/{n}]` | history, restore source | M3 |
| PATCH | `project/{p}/script/{id}` | name, archive | M3 |
| GET | `project/{p}/bank` | banks, project and builtin | M4 |
| GET | `project/{p}/bank/{b}/item` | filtered items, `matchCount` | M4 |
| POST/PUT/DELETE | `project/{p}/bank[/{b}/item…]` | project banks only | M4 |
| GET | `project/{p}/session/{s}/draw` | one session's draw | M4 |
| GET | `project/{p}/script/{id}/draw` | draw record, CSV | M4 |
| POST | `project/{p}/session/{s}/draw/_redraw` | unstarted sessions only | M4 |
| POST | `project/{p}/media` | upload a playback clip | M3 |
| POST | `project/{p}/script/{id}/preview-session` | tier-2 dry run | M4 |
