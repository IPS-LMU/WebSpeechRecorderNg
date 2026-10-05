# UI specification

Screen by screen, against the design canvas
<https://claude.ai/artifact/DAiLsAmG3cC2PXRSJbgQSe>. Each section lists the artboard it comes
from, the regions, the data it reads and writes, the interactions, and the states that are easy to
forget.

House rules for every screen:

- Colours come from `--spr-*` tokens only. No literals in components, light and dark both covered
  ([_tokens.scss](../../projects/speechrecorderng/src/lib/theme/_tokens.scss)). Canvas-drawn
  elements resolve tokens through `sprToken()`
  ([theme.ts](../../projects/speechrecorderng/src/lib/theme/theme.ts)).
- Interactive targets are at least 44 px high. Type sizes come from the `--spr-type-*` scale.
- Real `<button>`, `<a href>`, `<input>` with `<label>`. Never a click handler on a `div`.
- Every destructive action is reversible through undo, or asks first when it is not.
- Routes are deep-linkable and survive a reload: the selected node is in the URL.

## 1. Shell and routing

```
/                                     → redirect to /project/{p}/script
/project/:p/script                    library list                       §2
/project/:p/script/:id/edit           editor, selection in query         §3
      ?sel=script | s:2 | g:2:1 | i:2:0:1
/project/:p/script/:id/preview        preview, tier 1                    §4
/project/:p/script/:id/source         JSON and checks                    §5
/project/:p/script/:id/bank/:groupRef draw rule and bank browser         §6
/project/:p/script/:id/draws          resolved draws                     §7
/project/:p/bank                      banks across the project            §6
/project/:p/draws                     draws across the project, picker    §7
/project/:p/source                    → redirect to the library: a source view is per script
```

The shell holds: project breadcrumb, script name (editable in place), save state, the warning
count as a link to §5, Preview, Publish, and undo and redo. Save state has three visible forms —
"all changes saved", "saving…", and a persistent error with a Retry action. Never show a silent
failure: an autosave that cannot reach the server must block Publish and say why.

`401` sends the user to the deployment's login and returns afterwards. `403` keeps the editor in
read-only mode: every write control disabled with one explanatory line, nothing hidden.

## 2. Script library

*Artboard: Library.* Entry point and the home for cross-script actions.

- **Table.** Script name with its section names underneath, id, content summary ("4 sections, 11
  items + 20 drawn"), status chip (Draft, Published vN, Archived), usage ("14 sessions (v3)"),
  last edited, row actions (Edit, duplicate, archive, export JSON).
- **Filter row.** Search by name, id or itemcode; status filter (All, Drafts, Published,
  Archived).
- **Actions.** New script, Import JSON.
- **Legend cards.** Draft, Published, In use — three sentences explaining what each means for
  sessions. Keep them: this is where a new researcher learns the versioning model.
- Data: `GET project/{p}/script` (rest-api §2.1).
- Empty state: one line plus the two actions. Loading: skeleton rows, not a spinner on an empty
  page.

## 3. Editor

*Artboard: Main.* Three columns: outline, centre, inspector. The selected node drives both the
centre and the inspector, and lives in the URL.

### 3.1 Outline (left, 300 px)

Tree of script → sections → groups → items, each row a button. Rows show, in this order: label,
secondary text, markers. Markers: a dice for a drawn group with "draws 20 from <bank>", a speaker
icon for an item that plays media, a Training chip for a training section, a warning triangle
where a check applies.

- Drag to reorder within and between parents (`@angular/cdk/drag-drop`, already a dependency).
  Keyboard equivalent is required: `Alt+↑`/`Alt+↓` moves the selected node among its siblings.
- Filter box narrows by itemcode and prompt text, keeping ancestors of matches visible.
- A drawn group never lists fake children. It shows the rule, and its example items live in the
  centre.
- Large scripts: virtual scrolling above ~300 rows (`cdk-virtual-scroll-viewport`).

### 3.2 Centre

Two modes.

**Script selected** — the session flow: one card per section with its number, name, mode and its
one-line explanation, counts ("11 items + 20 drawn"), and a flag column (Training, "2 play
media"). Clicking a card selects that section.

**Section selected** — a header (section number, mode chip, prompt-phase chip, Training chip, the
name as an `h1`) and then one block per group:

- *Fixed group*: a table with columns grip, Itemcode, Prompt, Media, Kind, Timing, warning. The
  Media cell carries the speaker icon and reads "Text + plays first" when the item has playback.
  Rows are buttons; selecting one selects the item.
- *Drawn group*: no table. The bank title and its origin ("project bank" or "ships with the
  application"), the filter in words, a sentence stating what happens per session, a link to §6,
  and an **example draw** of up to four items with a "Draw another example" button. The example is
  clearly an example; drawn itemcodes shown there are the reserved ones (`RB001`…).

### 3.3 Inspector (right, 380 px)

Four variants. Fields map to the model one to one
([data-model.md](data-model.md)); the table below is the contract.

**Script**: id (read-only), name, `virtualViewBox.height`, counts (sections, fixed items, drawn
per session), a note about which versions sessions use, a **version history panel** (list, note
and session count per version, restore into the draft), and a link to §7.

**Section**: `name`; `mode` as three radio cards each with its consequence in one line; `promptphase`
as a select with help text that changes with the value; `order` (Sequential, Random — never
`RANDOMIZED`); `training` as a checkbox with its consequence; Delete.

**Group**: first a two-way radio group, **Fixed list** or **Drawn from bank**. Fixed shows
`order`, the item count and Split and Delete. Drawn shows: bank select grouped into "This project"
and "Ships with SpeechRecorder" plus an origin chip; the filter as a read-only summary with a link
to §6; `count` with live validation against `matchCount`; `fixedBy` as a select with help text;
`skipRecordedBySpeaker`; `itemcodePrefix` with a preview of the generated codes; and the sentence
that the draw happens once, at session creation. **Per D-W** this is the bank source type of the
single randomised-items mechanism: the panel is reached from the placeholder prompt item, whose
source picker also offers word and sentence lists (which are drawn when the script loads).

**Prompt item**:

| Control | Model field |
|---|---|
| Itemcode | `itemcode`, validated live (E01, E02) |
| Recording / Information only | `type` (unset vs `'nonrecording'`) |
| Prompt media select: Plain text, Formatted text, Image, Nothing on screen | shape of `mediaitems[0]` |
| Text area | `mediaitems[0].text` or `promptDoc` |
| File, alt text, virtual height | `mediaitems[0].src`, `.alt`, `.defaultVirtualViewBox` |
| Instructions | `recinstructions.recinstructions` |
| Playback block (below) | `playback` |
| Pre-rec delay, Rec duration, Post-rec delay | `prerecdelay`, `recduration`, `postrecdelay` |
| Display duration (information items) | `duration` |

The **playback block** is a bordered fieldset titled "Media played to the speaker". It edits the
item's **audio mediaitem** — the file, its alt text, `autoplay` and `replay` — plus the optional
placement modifier: `when` (default "With the prompt"), `repeats`, `gap`, `replayable`,
`maxReplays`, `headphones`, and an inline warning when `DURING` meets no headphones (W03). Empty
state: one sentence and an "Add audio or video…" button when the item has no audio; an audition
player (an editor-local `<audio>` element — the library's Web Audio player needs
`SpeechrecorderngModule` and is not imported, README §3), the file name and duration, and Remove.

The **timing block** ends in a timeline bar on the dark canvas token: playback span, pre-recording
delay, recording, post-recording delay, proportional to the real values from
`effectiveTiming(item)`. An unbounded recording is hatched; a clip that plays over an open
microphone hatches the recording segment. Below it, one sentence saying when the prompt becomes
visible, derived from `promptVisibleAt`. Both functions come from the library so the bar cannot
drift from the recorder (README §5).

## 4. Preview, tier 1

*Artboard: Preview.* An editor-side mock, instant, no server.

- **Speaker frame** at desktop, tablet or phone width: section name, Practice and "Drawn item"
  chips, progress, the prompt stage on the beige stage token, the playing state with a level
  display, a replay button when `replayable`, the traffic light plus a fourth lamp for playback,
  the status line and the transport buttons.
- **Step simulation**: Idle, Listening, Pre-rec, Recording, Post-rec. Steps that do not apply to
  the current item are disabled, not hidden, so the model is legible.
- **Headphone notice** above the frame when the item requires them.
- **Session order list** on the right with the drawn items folded in at their place, marked as
  drawn, plus a Re-draw button that reshuffles the example.
- Prompt visibility, timing and phase order come from the library functions and the shared
  phase-transition table, never from a local copy of the rules.
- A banner states what this is: "Nothing is recorded or uploaded", and the full dry run (tier 2,
  rest-api §6) is one button away.

## 5. JSON source and checks

*Artboard: Source.*

- **Left**: the draft as formatted JSON with line numbers, read-write, gutter dots for lines
  carrying a check, and a Format action. Edits apply to the draft when the JSON parses and the
  invariants hold; while it does not parse, the structure view is frozen and the error is shown at
  its line. Text that does not parse is never sent to the server: the saved draft stays at the last
  valid version, the shell reads "unsaved changes", and the text survives a reload from a local
  backup. A plain textarea with validation is enough — do not pull in a code-editor dependency
  for this.
- **Right**: counts (errors, warnings, notes) and the check cards. Each card: severity chip,
  `line · subject`, one sentence of consequence, and either a deep link into the editor or the
  one-click fix ([validation.md](validation.md)).
- **Header**: Import JSON, Download `script-{id}.json`, Publish.
- Errors block Publish; warnings do not, and are shown to whoever publishes.

## 6. Item bank and draw rule

*Artboard: Bank.* Reached from a drawn group; it edits that group's rule.

- **Bank picker** grouped into "This project" and "Ships with SpeechRecorder", with an origin chip
  under it. A shipped bank shows "read-only", disables item editing and offers "Copy to this
  project to edit"; the explanatory paragraph states the trade (travels between installations
  versus editable here).
- **Filter**: category, length, has model recording, tag, free text. This filter is the persistable
  `draw.filter`: free text is `q`, tags are ANDed, word bounds are inclusive. The live count
  reads "{matchCount} of {total} items match". A warning appears when the rule plays bank audio and
  some matching items have none (W04). A separate browse filter, when offered, is visually
  distinct and is never written to the draft.
- **Item table**: bank id, item, words, model audio (with an audition button), times used.
  Paginated through `limit`/`offset`; the footer says how many of the matches are shown. A project
  bank also offers **Add item** and **Import CSV** — the columns are `text,category,words,tags,audio`
  (rest-api §3.3) and the server appends; the result line names what it took (`{imported} imported,
  {skipped} skipped`) and the first refused line. A shipped bank offers neither.
- **Rule panel**: `count` validated against `matchCount` (E04), `order`, `fixedBy` with help,
  `skipRecordedBySpeaker` with its fallback explained, `itemcodePrefix` with generated codes,
  "Play the bank item's model recording", an example draw with a Draw-again button, and a link to
  §7.
- "Use this rule" returns to the editor. Changes are part of the draft and therefore undoable.

## 7. Resolved draws

*Artboard: Draws.* Read-only, except re-draw.

- **Table**: session, speaker, drawn and recorded counts, the first itemcodes, status chip.
  Preview (`type: "TEST"`) sessions are hidden by default and carry a "Preview" chip when shown.
- **Detail panel**: session id and status, speaker, script version, when the draw was made, the
  bank and its origin, a note explaining this session's case (for example that items were skipped
  because the speaker recorded them before), and the full item list with itemcode, bank id, text
  and a recorded dot. The trace stores ids, not prose: the **text is looked up from the bank as it is
  now** and is labelled as such, because an edited or retired bank item must not appear to rewrite
  what a finished session recorded.
- **Actions**: Download CSV; Re-draw, enabled only for `CREATED` sessions, with the reason shown
  when disabled.
- The paragraph explaining that the draw is fixed at session creation stays on the page. It is the
  answer to the question this screen exists to answer.
- Speaker identifiers may need to be pseudonyms here (README §8.4).

## 8. Accessibility and keyboard

Required, not optional: verified at each milestone and closed at M5:

- Tab order follows the visual order in all three columns. The outline, the table and the
  inspector are each a tab stop that then uses arrow keys internally.
- Outline: `↑`/`↓` move, `→`/`←` expand and collapse, `Alt+↑`/`Alt+↓` reorder, `Enter` selects,
  `Delete` deletes with undo.
- Global: `Cmd/Ctrl+Z` and `Shift+Cmd/Ctrl+Z` undo and redo, `Cmd/Ctrl+S` forces a save, `/`
  focuses the outline filter.
- Radio groups use `role="radiogroup"` with `aria-checked`, as the mockups do; invalid fields use
  `aria-invalid` plus a text message, never colour alone; the selected row carries `aria-current`.
- Icon-only buttons have `aria-label`. The traffic light and the level display are decorative in
  the preview: the status is always also text.
- Check severity is never colour alone: the chip carries the word.
- Screen-reader pass with VoiceOver on Safari and NVDA on Firefox, one pass per milestone from M2.

## 9. States to get right

| Screen | Empty | Loading | Error |
|---|---|---|---|
| Library | no scripts: one line, New and Import | skeleton rows | retry with the server message |
| Editor | script with no sections: one card inviting a section | outline skeleton, inspector blank | draft load failure blocks editing, never shows an empty script as if it were real; a script that has published versions and no draft (a migrated one) offers Start a draft from the published version instead of a dead end |
| Drawn group | no bank chosen: the group says so and points right | — | bank unreachable: the rule stays visible, the counts show "unknown" and `count` validation is suspended |
| Preview | script with no items | — | a missing playback file shows a labelled placeholder, not a silent gap |
| Bank | filter matches nothing: offer to widen it | table skeleton | — |
| Draws | no sessions yet: one line | skeleton rows | — |

A note on the draw-rule editor: when `matchCount` cannot be fetched, do **not** fall back to
"valid". Suspend the check, say the count is unknown, and let Publish proceed with a warning — the
server re-checks on publish anyway (rest-api §2.4). The same applies to W05 on a drawn group when
the bank's clip durations are unknown and to W11 when the media list cannot be fetched.
