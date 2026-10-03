# Check catalogue

One source of truth for the editor's checks panel, the outline markers and the server's publish
gate. Each check has a stable id, so a message can be rewritten without breaking tests or the
server's `details.checks` payload (rest-api §2.4).

Severities:

- **Error** blocks publishing. The server re-checks every error and refuses with `409`.
- **Warning** does not block. It is shown in the editor and again to whoever publishes.
- **Note** is informational, often with a one-click fix.

Implementation: `core/validation/` in the editor, one pure function per check over the draft, each
returning zero or more findings `{ id, severity, path, message, fix? }` where `path` is a JSON
path into the script (`sections[2].groups[0].promptItems[1].itemcode`). The panel groups by
severity, the outline marks any node whose subtree has a finding, and `path` drives the deep link.
Unit-test one spec per id, including the clean case.

## Errors

| Id | Trigger | Message | Fix |
|---|---|---|---|
| E01 | `itemcode` empty or whitespace | Itemcode is required. | focus the field |
| E02 | two items share an `itemcode` (drawn codes included) | Another item already uses this itemcode. | offer the next free code |
| E03 | a bank source names no bank (`prefill.bank.bank` empty), or the named bank does not exist | The item draws from a bank but no bank is chosen. | open the bank picker |
| E04 | a bank source's `count` exceeds the filter's `matchCount`; suspended when the bank cannot be read | The filter matches only {matchCount} items. Widen the filter or draw fewer. | set `count` to `matchCount` |
| E05 | a fixed itemcode falls inside a bank source's reserved range, two bank sources share `itemcodePrefix`, or a bank source's `itemcodePrefix` is empty | Itemcodes {prefix}001–{prefix}{n} are reserved by the bank source in {section}, item {code}. | suggest a free prefix |
| E06 | `playback` without an audio mediaitem (no mediaitem whose `mimetype` starts with `audio`) | The item plays media but no file is chosen. | open the file picker |
| E07 | no mediaitem has `text`, `promptDoc` or `src`, and none is audio — the whole `mediaitems` list is considered, not only the first entry, and `playback` does not count as something to play (E06 covers that case) | The item shows nothing and plays nothing. | — |
| E08 | retired by D-W: a group can no longer hold both a rule and a fixed list, so the condition is unrepresentable | — | — |
| E09 | `draw.count` < 1 or not a whole number, or a timing field is negative or not a number | `count` must be a positive whole number; a timing field must be a positive number of milliseconds. | — |
| E10 | script has no section, or a section has no group | A script needs at least one section with one group. | add one |
| E11 | `repeats` < 1, `gap` or `maxReplays` negative, a virtual view box height ≤ 0, or `draw.count` > 999 | `repeats` must be at least 1; `gap` and `maxReplays` must not be negative; view box heights must be > 0; a draw holds at most 999 items. | — |

E04 is suspended, not passed, when the bank cannot be reached (ui-spec §9). The same applies to
W05 on a drawn group when the bank's clip durations are unknown, and to W11 when the media index
cannot be fetched. The server still enforces the error checks on publish.

## Warnings

| Id | Trigger | Message |
|---|---|---|
| W01 | `AUTORECORDING` section, recording item, no `recduration` | The section records automatically, but this item has no duration. The recording runs until the speaker presses Next. |
| W02 | image prompt without `alt` | Image prompt has no alt text. Screen-reader users get no prompt, and lists show only the file name. |
| W03 | `playback.when: 'DURING'` without `headphones`, on a prompt item or a `draw.playback` | Playing while recording captures the sound through the microphone unless headphones are required. |
| W04 | `draw.playBankAudio` and `withoutAudio > 0` for the filter | {withoutAudio} of the {matchCount} matching items have no model recording. Those items would appear without sound. |
| W05 | `when: 'PRERECORDING'` and the clip (with repeats and gaps) is longer than the pre-recording delay; on a drawn group only when the bank reports clip durations | The clip is {clip} ms but the pre-recording delay is {delay} ms, so recording starts while it still plays. |
| W06 | `type: 'nonrecording'` carries `recduration`, or a recording item carries `duration` | {field} has no effect on this kind of item. |
| W07 | a training section contains a drawn group | Training items are exempt from the completeness check, so a draw here consumes bank items without producing required recordings. |
| W08 | `mediaitems` longer than one entry | Only the first media item is shown by the recorder. The others are ignored. |
| W09 | `playback.replayable` (or `Mediaitem.replay` when no `playback` is set) with no `maxReplays` in an `AUTORECORDING` section | The speaker can replay without limit while the section advances on its own. |
| W10 | `minRecorderVersion` higher than the version this deployment reports | This script needs recorder {required}; the deployment runs {actual}. Playback would be skipped silently. |
| W11 | a playback or image file referenced by the draft is missing from the project's media; suspended when the media index cannot be fetched | {src} is not in the project's media. |
| W12 | `playback.when` is `PRERECORDING` or `DURING` on a `type: 'nonrecording'` item | The item has no recording phase, so the clip plays at the wrong moment; use `WITH_PROMPT`, `BEFORE` or `ONDEMAND`. |
| W13 | `playback` is set together with `Mediaitem.autoplay` or `Mediaitem.replay` | The item declares its placement twice; `playback` wins and the mediaitem flags are ignored. |

W08 carries the fix described in [data-model.md](data-model.md) §6; it stays a warning because the
extra entries may be deliberate data a future recorder will use.

## Notes

| Id | Trigger | Message | Fix |
|---|---|---|---|
| N01 | `prerecording` or `postrecording` set while the modern key is unset | {legacy} is read as the {modern} because {modern} is not set. | rename to the modern key |
| N02 | `order: 'RANDOMIZED'` | The recorder does not implement RANDOMIZED and treats it as sequential. | replace with Random or Sequential |
| N03 | the script contains a draw rule | {drawn} items are drawn per session, on top of {fixed} fixed items, so a session runs {total} items. | — |
| N04 | an edit lifts `minRecorderVersion` | This script now needs recorder {version} or newer, because it uses {feature}. | — |
| N05 | a drawn group's `fixedBy: 'SPEAKER'` while `skipRecordedBySpeaker` is also set | A speaker-stable draw repeats the same items, so skipping what the speaker recorded can empty the draw. | — |
| N06 | a section has `promptUnits` and no `groups` | This section predates groups. The editor opens it read-only until it is converted, so saving never adds an empty `groups`. | convert to groups, explicitly chosen |

## Publish gate

```
errors = 0           → publish allowed
errors > 0           → blocked, the panel lists them, the button says why
warnings > 0         → allowed; the publish dialog lists them and asks for confirmation
```

The server repeats every error check and the invariants in
[data-model.md](data-model.md) §4 before it freezes a version. A client-side-only check is a bug:
the editor is not the only thing that can write a draft.
