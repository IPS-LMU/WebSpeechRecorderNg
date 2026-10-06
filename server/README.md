# The receiver

The REST API the recorder and the script editor talk to. It is the **draft of the production
server**: the API shape and the on-disk layout in `store.mjs` are contracts, so a layout change
ships with a migration.

Node builtins only — no dependencies, no install step.

## Run

```bash
npm run serve:api                                   # http://127.0.0.1:8080, data in server/data
npm run serve:api -- --port 4301 --data /tmp/spr --seed src/test
node server/server.mjs --help
```

`--api-base` must match the application's `apiEndPoint` (`/api/v1` by default). The data directory
is seeded from `--seed` (`src/test` by default) on first run; `server/data` is gitignored.

## Tests

```bash
node --test server/*.test.mjs   # 60 specs: drafts, publish, validation corpus, banks, media,
                                # draw resolution, previews, maintenance
```

The explicit file list, not `server/`: Node 22's runner treats a directory argument as an entry
module (`MODULE_NOT_FOUND`) and only learned to scan one in a later major (plan §11.48).

CI runs this and the other five jobs (`.github/workflows/tests.yml`).

## Data layout

```
<data>/project/<id>.json              project configuration
<data>/project/<id>/<resource>        project resources (images, media/)
<data>/project/<id>/media/<name>      uploaded clips and images (+ index.json for duration)
<data>/script/<id>/meta.json          name, archived, publishedVersion, draftVersion, layoutVersion
<data>/script/<id>/published.json     what GET script/{id} serves
<data>/script/<id>/draft.json         current draft (ETag = sha256 of these bytes)
<data>/script/<id>/versions/<n>.json  immutable published versions (never pruned)
<data>/script/<id>/revisions/<n>.json draft snapshots (pruned by gc)
<data>/script/<id>.json               legacy flat script: read as published v1, never written
<data>/session/<id>.json              session; bank draws and prefill choices are recorded here
<data>/recordingfile/<id>.{json,wav}  recording metadata and audio
<data>/bank/<id>.json                 item banks (BUILTIN banks are read-only)
<data>/uploads/                       runtime state: idempotency journal, chunk sessions, ids
```

## Maintenance

```bash
node server/server.mjs --data <dir> --migrate          # per-script layout for legacy flat scripts
node server/server.mjs --data <dir> --gc               # prune draft revisions + expired previews
node server/server.mjs --data <dir> --gc --gc-media    # also delete unreferenced media
```

* **Draft revisions** are kept 50 deep and 30 days (see `Store.pruneDraftRevisions`).
* **Unreferenced** means no draft, no published version and no **bank item** names the file: a drawn
  group plays the recording its bank item points at, so a clip only a bank refers to is in use and
  `--gc-media` leaves it alone (plan §11.51).
* **Preview sessions** (`type: "TEST"`) expire; `gc` removes the session and its materialised script,
  never the source script.
* **Published versions and recordings are never touched** by `gc`.
* `--migrate` is idempotent and is safe to run on every deployment.

## Backup, restore, transfer

The whole state is the data directory: stop nothing, copy the tree (rsync, tar), restore it into a
fresh `--data`. Do not copy `uploads/tmp`. To move a deployment to a newer receiver build, copy the
tree and run `--migrate` once; the layout version in each `meta.json` says which layout a script is
in. Verify with `--gc` (read-only for versions) and by fetching a published script.

## Production notes

The receiver itself has no authentication; the deployment puts it behind the same protection as the
recorder (the sample `apache_www_htaccess_sample.txt` shows the SPA fallback pattern). Auth, CSRF,
retention policy and backups belong to that deployment, not to this process. Changes here are
transferred to production, so keep the recorder-facing paths (`GET script/{id}`,
`project/{p}/<resource>`, the upload routes) compatible and add a migration when the layout changes.
