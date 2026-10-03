/**
 * The inspector's write path (ui-spec §3.3). The draft service is a fake that records the exact
 * `setValue`/`insert`/`remove` calls, so every control's model mapping is asserted by path, focus
 * key and value. The media block is exercised against a real `MediaService` with
 * `HttpTestingController`, because the upload/delete call shapes (rest-api.md §5) are the contract.
 */
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {ApiType, SPEECHRECORDER_CONFIG, type Bank, type Mediaitem, type PromptItem} from 'speechrecorderng';
import type {BankView} from '../../core/validation';
import {MediaService} from '../../core/media.service';
import {ScriptDraftService} from '../../core/script-draft.service';
import type {EditorScript} from '../../core/script.model';
import {EditorInspector} from './editor-inspector';

interface DraftCall {
  method: 'setValue' | 'insert' | 'remove';
  focus: string;
  path: ReadonlyArray<string | number>;
  value?: unknown;
  index?: number;
}

function fakeDraft(writesDisabled: () => boolean) {
  const calls: DraftCall[] = [];
  return {
    calls,
    setValue(focus: string, path: ReadonlyArray<string | number>, value: unknown) {
      calls.push({method: 'setValue', focus, path, value});
    },
    insert(focus: string, path: ReadonlyArray<string | number>, index: number, value: unknown) {
      calls.push({method: 'insert', focus, path, index, value});
    },
    remove(focus: string, path: ReadonlyArray<string | number>, index: number) {
      calls.push({method: 'remove', focus, path, index});
    },
    move() { /* unused by the inspector */ },
    writesDisabled,
  };
}

const promptItem = (overrides: Partial<PromptItem> = {}): PromptItem => ({
  itemcode: 'a',
  mediaitems: [{mimetype: 'text/plain', text: 'Hello'}],
  ...overrides,
});

const scriptOf = (items: PromptItem[]): EditorScript => ({
  name: 'Script',
  sections: [{
    name: 'Section',
    mode: 'MANUAL',
    promptphase: 'RECORDING',
    order: 'SEQUENTIAL',
    groups: [{order: 'SEQUENTIAL', promptItems: items}],
  }],
}) as unknown as EditorScript;

const drawnScript = (count: number): EditorScript => scriptOf([
  {
    itemcode: 'RB',
    mediaitems: [],
    prefill: {bank: {bank: 'words', bankSource: 'PROJECT', count, itemcodePrefix: 'RB'}},
  },
]);

interface Options {
  script: EditorScript;
  selection: {kind: 'script'} | {kind: 'section'; section: number} | {kind: 'group'; section: number; group: number} | {kind: 'item'; section: number; group: number; item: number};
  writesDisabled?: () => boolean;
  media?: ReadonlyArray<{src: string; mimetype?: string; durationMs?: number | null}>;
  bankViews?: ReadonlyMap<string, BankView>;
  bankList?: ReadonlyArray<Bank>;
}

function mount(options: Options) {
  const draft = fakeDraft(options.writesDisabled ?? (() => false));
  httpReady = true;
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {provide: SPEECHRECORDER_CONFIG, useValue: {apiEndPoint: '', apiType: ApiType.NORMAL, apiVersion: 1}},
      MediaService,
      {provide: ScriptDraftService, useValue: draft},
    ],
  });
  const fixture = TestBed.createComponent(EditorInspector);
  fixture.componentRef.setInput('script', options.script);
  fixture.componentRef.setInput('selection', options.selection);
  fixture.componentRef.setInput('project', 'Demo1');
  if (options.media !== undefined) {
    fixture.componentRef.setInput('media', options.media);
  }
  if (options.bankViews !== undefined) {
    fixture.componentRef.setInput('bankViews', options.bankViews);
  }
  if (options.bankList !== undefined) {
    fixture.componentRef.setInput('bankList', options.bankList);
  }
  fixture.detectChanges();
  return {fixture, component: fixture.componentInstance, draft, http: TestBed.inject(HttpTestingController)};
}

let httpReady = false;

beforeEach(() => {
  httpReady = false;
});

afterEach(() => {
  if (httpReady) {
    TestBed.inject(HttpTestingController).verify();
  }
});

describe('EditorInspector writes — script variant', () => {
  it('maps the name and writes a fresh view box when one is absent', () => {
    const {component, draft} = mount({script: scriptOf([promptItem()]), selection: {kind: 'script'}});

    component.setScriptName('Renamed');
    component.setScriptHeight('420');

    expect(draft.calls).toEqual([
      {method: 'setValue', focus: 'script.name', path: ['name'], value: 'Renamed'},
      {method: 'setValue', focus: 'script.virtualViewBox.height', path: ['virtualViewBox'], value: {height: 420}},
    ]);
  });

  it('writes only the height when the view box exists', () => {
    const script = {...scriptOf([promptItem()]), virtualViewBox: {height: 100, 'data-x': 1}} as EditorScript;
    const {component, draft} = mount({script, selection: {kind: 'script'}});

    component.setScriptHeight('300');

    expect(draft.calls[0]).toEqual({
      method: 'setValue',
      focus: 'script.virtualViewBox.height',
      path: ['virtualViewBox', 'height'],
      value: 300,
    });
  });

  it('emits the restored version instead of writing the draft', () => {
    const {component, draft, fixture} = mount({script: scriptOf([promptItem()]), selection: {kind: 'script'}});
    fixture.componentRef.setInput('versions', [{version: 3, note: 'n', publishedDate: '2026-01-01'}]);
    fixture.componentRef.setInput('versionSessions', new Map([[3, 7]]));
    fixture.detectChanges();

    const restored: number[] = [];
    component.restoreVersion.subscribe((version) => restored.push(version));
    const button = (fixture.nativeElement as HTMLElement).querySelector('.version-row button') as HTMLButtonElement;
    expect(button.textContent).toContain('Restore');
    button.click();

    expect(restored).toEqual([3]);
    expect(draft.calls).toEqual([]);
  });
});

describe('EditorInspector writes — section variant', () => {
  it('maps every section control and refuses RANDOMIZED', () => {
    const {component, draft} = mount({script: scriptOf([promptItem()]), selection: {kind: 'section', section: 0}});

    component.setSectionName('Intro');
    component.setSectionMode('AUTORECORDING');
    component.setSectionPromptPhase('PRERECORDING');
    component.setSectionOrder('RANDOM');
    component.setSectionTraining(true);
    component.setSectionOrder('RANDOMIZED');

    expect(draft.calls).toEqual([
      {method: 'setValue', focus: 'section.0.name', path: ['sections', 0, 'name'], value: 'Intro'},
      {method: 'setValue', focus: 'section.0.mode', path: ['sections', 0, 'mode'], value: 'AUTORECORDING'},
      {method: 'setValue', focus: 'section.0.promptphase', path: ['sections', 0, 'promptphase'], value: 'PRERECORDING'},
      {method: 'setValue', focus: 'section.0.order', path: ['sections', 0, 'order'], value: 'RANDOM'},
      {method: 'setValue', focus: 'section.0.training', path: ['sections', 0, 'training'], value: true},
    ]);
  });

  it('deletes the section by index', () => {
    const {component, draft} = mount({script: scriptOf([promptItem()]), selection: {kind: 'section', section: 0}});
    component.deleteSection();
    expect(draft.calls).toEqual([{method: 'remove', focus: 'section.delete', path: ['sections'], index: 0}]);
  });
});

describe('EditorInspector writes — drawn group variant', () => {
  const view: BankView = {bankId: 'words', items: [{bankItemId: '1'}, {bankItemId: '2'}, {bankItemId: '3'}]};

  it('maps the bank, the count, fixedBy, skip and prefix, and emits bankRequested', () => {
    const {component, draft} = mount({
      script: drawnScript(3),
      selection: {kind: 'group', section: 0, group: 0},
      bankViews: new Map([['words', view]]),
    });
    const requested: string[] = [];
    component.bankRequested.subscribe((bankId) => requested.push(bankId));

    component.setGroupBank('words');
    component.setGroupCount('2');
    component.setGroupFixedBy('SPEAKER');
    component.setGroupSkipRecorded(true);
    component.setGroupPrefix('RB');

    expect(draft.calls).toEqual([
      {method: 'setValue', focus: 'group.0.0.bank', path: ['sections', 0, 'groups', 0, 'promptItems', 0, 'prefill', 'bank', 'bank'], value: 'words'},
      {method: 'setValue', focus: 'group.0.0.count', path: ['sections', 0, 'groups', 0, 'promptItems', 0, 'prefill', 'bank', 'count'], value: 2},
      {method: 'setValue', focus: 'group.0.0.fixedBy', path: ['sections', 0, 'groups', 0, 'promptItems', 0, 'prefill', 'bank', 'fixedBy'], value: 'SPEAKER'},
      {method: 'setValue', focus: 'group.0.0.skipRecordedBySpeaker', path: ['sections', 0, 'groups', 0, 'promptItems', 0, 'prefill', 'bank', 'skipRecordedBySpeaker'], value: true},
      {method: 'setValue', focus: 'group.0.0.itemcodePrefix', path: ['sections', 0, 'groups', 0, 'promptItems', 0, 'prefill', 'bank', 'itemcodePrefix'], value: 'RB'},
    ]);
    expect(requested).toEqual(['words']);
  });

  it('flags a count above matchCount with the E04 message', () => {
    const {component} = mount({
      script: drawnScript(9),
      selection: {kind: 'group', section: 0, group: 0},
      bankViews: new Map([['words', view]]),
    });
    expect(component.countExceeds()).toBe(true);
    expect(component.countMessage()).toContain('3');
  });

  it('suspends the count when the bank cannot be read', () => {
    const {component} = mount({
      script: drawnScript(2),
      selection: {kind: 'group', section: 0, group: 0},
      bankViews: new Map(),
    });
    expect(component.countSuspended()).toBe(true);
    expect(component.countMessage()).toContain('cannot be validated');
  });

  it('inserts the second half and trims the original on Split', () => {
    const {component, draft} = mount({
      script: scriptOf([promptItem({itemcode: 'a'}), promptItem({itemcode: 'b'}), promptItem({itemcode: 'c'})]),
      selection: {kind: 'group', section: 0, group: 0},
    });

    component.splitGroup();

    expect(draft.calls.length).toBe(2);
    expect(draft.calls[0].method).toBe('insert');
    expect(draft.calls[0].path).toEqual(['sections', 0, 'groups']);
    expect(draft.calls[0].index).toBe(1);
    // The inserted value is the new group the pure helper built; the shape is the test's contract.
    const inserted = draft.calls[0].value as {promptItems: PromptItem[]};
    expect(inserted.promptItems.map((item) => item.itemcode)).toEqual(['c']);
    expect(draft.calls[1]).toEqual({
      method: 'setValue',
      focus: 'group.0.0.split',
      path: ['sections', 0, 'groups', 0, 'promptItems'],
      value: [{itemcode: 'a', mediaitems: [{mimetype: 'text/plain', text: 'Hello'}]},
        {itemcode: 'b', mediaitems: [{mimetype: 'text/plain', text: 'Hello'}]}],
    });
  });
});

describe('EditorInspector writes — prompt item variant', () => {
  const itemScript = () => scriptOf([
    promptItem({mediaitems: [{mimetype: 'text/plain', text: 'Hello'}, {mimetype: 'audio/wav', src: 'media/a.wav'}]}),
  ]);
  const selection = {kind: 'item', section: 0, group: 0, item: 0} as const;

  it('validates the itemcode live and marks the field invalid', () => {
    const blank = scriptOf([promptItem({itemcode: '  '})]);
    const {component, fixture} = mount({script: blank, selection});

    expect(component.itemcodeIssues().map((finding) => finding.id)).toEqual(['E01']);
    expect(component.itemcodeMessage()).not.toBeNull();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input[aria-invalid="true"]');
    expect(input).not.toBeNull();
  });

  it('maps type, media kind, text and timings', () => {
    const {component, draft} = mount({script: itemScript(), selection});

    component.setItemType(false);
    component.setItemType(true);
    component.setPromptText('New text');
    component.setInstructions('Read it');
    component.setPreDelay('100');
    component.setRecDuration('2000');
    component.setDisplayDuration('1500');

    expect(draft.calls[0]).toEqual({method: 'setValue', focus: 'item.0.0.0.type', path: ['sections', 0, 'groups', 0, 'promptItems', 0, 'type'], value: 'nonrecording'});
    expect(draft.calls[1].value).toBeUndefined();
    expect(draft.calls[2]).toEqual({method: 'setValue', focus: 'item.0.0.0.text', path: ['sections', 0, 'groups', 0, 'promptItems', 0, 'mediaitems', 0, 'text'], value: 'New text'});
    expect(draft.calls[3].value).toEqual({recinstructions: 'Read it'});
    expect(draft.calls[4].value).toBe(100);
    expect(draft.calls[5].value).toBe(2000);
    expect(draft.calls[6].value).toBe(1500);
  });

  it('keeps the audio mediaitem when the prompt kind changes', () => {
    const {component, draft} = mount({script: itemScript(), selection});
    component.setPromptMediaKind('image');
    const value = draft.calls[0].value as Mediaitem[];
    expect(value[0].mimetype).toBe('image/png');
    expect(value[1]).toEqual({mimetype: 'audio/wav', src: 'media/a.wav'});
  });

  it('inserts an audio mediaitem on "Add audio or video…"', () => {
    const noAudio = scriptOf([promptItem()]);
    const {component, draft} = mount({script: noAudio, selection});
    expect(component.audio()).toBeNull();
    component.addAudio();
    expect(draft.calls[0]).toEqual({
      method: 'insert',
      focus: 'item.0.0.0.playback.add',
      path: ['sections', 0, 'groups', 0, 'promptItems', 0, 'mediaitems'],
      index: 1,
      value: {mimetype: 'audio/wav'},
    });
  });

  it('writes the playback modifier and removes the audio mediaitem', () => {
    const {component, draft} = mount({script: itemScript(), selection});
    component.setPlaybackWhen('DURING');
    expect(draft.calls[0]).toEqual({
      method: 'setValue',
      focus: 'item.0.0.0.playback.when',
      path: ['sections', 0, 'groups', 0, 'promptItems', 0, 'playback'],
      value: {when: 'DURING'},
    });

    component.removeAudio();
    expect(draft.calls[1]).toEqual({
      method: 'remove',
      focus: 'item.0.0.0.playback.remove',
      path: ['sections', 0, 'groups', 0, 'promptItems', 0, 'mediaitems'],
      index: 1,
    });
  });

  it('warns W03 when DURING meets no headphones', () => {
    const script = scriptOf([promptItem({playback: {when: 'DURING'}})]);
    const {component} = mount({script, selection});
    expect(component.w03()).toBe(true);
  });
});

describe('EditorInspector media endpoints', () => {
  const selection = {kind: 'item', section: 0, group: 0, item: 0} as const;
  const mediaScript = () => scriptOf([
    promptItem({mediaitems: [{mimetype: 'text/plain', text: 'Hello'}, {mimetype: 'audio/wav', src: 'media/a.wav'}]}),
  ]);

  it('uploads with X-Filename, attaches the src and records the duration', () => {
    const {component, draft, fixture, http} = mount({script: mediaScript(), selection});
    const changed: number[] = [];
    component.mediaChanged.subscribe(() => changed.push(1));

    const file = new File([new Uint8Array([1, 2, 3])], 'clip.wav', {type: 'audio/wav'});
    component.onAudioUpload({target: {files: [file], value: ''}} as unknown as Event);

    const request = http.expectOne((candidate) => candidate.method === 'POST' && candidate.url === 'project/Demo1/media');
    expect(request.request.headers.get('X-Filename')).toBe('clip.wav');
    expect(request.request.body).toBe(file);
    request.flush({src: 'media/clip.wav', mimetype: 'audio/wav', durationMs: 1234});

    expect(draft.calls[0]).toEqual({
      method: 'setValue',
      focus: 'item.0.0.0.playback.upload',
      path: ['sections', 0, 'groups', 0, 'promptItems', 0, 'mediaitems'],
      value: [{mimetype: 'text/plain', text: 'Hello'}, {mimetype: 'audio/wav', src: 'media/clip.wav'}],
    });
    expect(draft.calls[1]).toEqual({
      method: 'setValue',
      focus: 'item.0.0.0.playback.upload',
      path: ['playback'],
      value: {durationMs: 1234},
    });
    expect(changed).toEqual([1]);
    expect(fixture.componentInstance.uploadError()).toBeNull();
  });

  it('deletes the project file and emits mediaChanged on success', () => {
    const {component, http} = mount({script: mediaScript(), selection});
    const changed: number[] = [];
    component.mediaChanged.subscribe(() => changed.push(1));

    component.deleteMedia();

    const request = http.expectOne((candidate) => candidate.method === 'DELETE' && candidate.url === 'project/Demo1/media/a.wav');
    request.flush({deleted: true});

    expect(changed).toEqual([1]);
    expect(component.deleteError()).toBeNull();
  });

  it('surfaces 409 MEDIA_IN_USE inline and does not touch the draft', () => {
    const {component, draft, http} = mount({script: mediaScript(), selection});

    component.deleteMedia();

    const request = http.expectOne((candidate) => candidate.method === 'DELETE');
    request.flush({error: 'MEDIA_IN_USE', usedBy: [{scriptId: '1245', version: 3}]}, {status: 409, statusText: 'Conflict'});

    expect(component.deleteError()).toContain('published version');
    expect(draft.calls).toEqual([]);
  });
});

describe('EditorInspector read-only mode', () => {
  it('disables the editable controls when writes are disabled', () => {
    const {fixture} = mount({
      script: scriptOf([promptItem()]),
      selection: {kind: 'section', section: 0},
      writesDisabled: () => true,
    });
    const host = fixture.nativeElement as HTMLElement;
    const name = host.querySelector('input[type="text"]') as HTMLInputElement;
    expect(name.disabled).toBe(true);
    expect(host.textContent).toContain('read-only');
  });
});

describe('EditorInspector randomised-items panel (D-W)', () => {
  const selection = {kind: 'item', section: 0, group: 0, item: 0} as const;
  const listScript = () => scriptOf([
    promptItem({itemcode: 'L', mediaitems: [], prefill: {source: 'words', select: 'random', itemcodeFormat: '{n}'}}),
  ]);
  const drawnCount = (count: number) => scriptOf([
    {itemcode: 'RB', mediaitems: [], prefill: {bank: {bank: 'words', bankSource: 'PROJECT', count, itemcodePrefix: 'RB'}}},
  ]);

  it('switches a list to a bank, leaving only the bank source', () => {
    const {component, draft} = mount({script: listScript(), selection});
    component.setPrefillKind('bank');

    expect(draft.calls).toEqual([{
      method: 'setValue',
      focus: 'item.0.0.0.prefill.source',
      path: ['sections', 0, 'groups', 0, 'promptItems', 0, 'prefill'],
      value: {bank: {bank: '', bankSource: 'PROJECT', count: 1, itemcodePrefix: ''}},
    }]);
    expect('source' in (draft.calls[0].value as object)).toBe(false);
  });

  it('switches a bank to a list, leaving only the list fields', () => {
    const {component, draft} = mount({script: drawnCount(2), selection});
    component.setPrefillKind('sentence');

    const value = draft.calls[0].value as Record<string, unknown>;
    expect(Object.keys(value).sort()).toEqual(['itemcodeFormat', 'select', 'source']);
    expect(value['source']).toBe('');
    expect(value['select']).toBe('random');
    expect('bank' in value).toBe(false);
  });

  it('tracks the word/sentence flavour the model cannot store', () => {
    const {component, draft} = mount({script: listScript(), selection});
    expect(component.prefillSelection()).toBe('word');
    component.setPrefillKind('sentence');

    expect(component.prefillSelection()).toBe('sentence');
    expect(draft.calls[0].value).toEqual({source: 'words', select: 'random', itemcodeFormat: '{n}'});
  });

  it('clears the prefill for a plain fixed item', () => {
    const {component, draft} = mount({script: listScript(), selection});
    component.setPrefillKind('none');
    expect(draft.calls[0]).toEqual({
      method: 'setValue',
      focus: 'item.0.0.0.prefill.source',
      path: ['sections', 0, 'groups', 0, 'promptItems', 0, 'prefill'],
      value: undefined,
    });
  });

  it('writes source, select and itemcodeFormat at their documented paths', () => {
    const {component, draft} = mount({script: listScript(), selection});
    component.setPrefillSource('sentences');
    component.setPrefillSelect('random');
    component.setPrefillItemcodeFormat('6.{n}');

    expect(draft.calls.map((call) => call.path)).toEqual([
      ['sections', 0, 'groups', 0, 'promptItems', 0, 'prefill', 'source'],
      ['sections', 0, 'groups', 0, 'promptItems', 0, 'prefill', 'select'],
      ['sections', 0, 'groups', 0, 'promptItems', 0, 'prefill', 'itemcodeFormat'],
    ]);
    expect(draft.calls.map((call) => call.value)).toEqual(['sentences', 'random', '6.{n}']);
  });

  it('writes the bank rule at the selected item, not the group placeholder', () => {
    const {component, draft} = mount({script: drawnCount(2), selection});
    component.setGroupCount('5');
    component.setGroupFixedBy('SPEAKER');
    component.setGroupPrefix('RB');

    expect(draft.calls).toEqual([
      {method: 'setValue', focus: 'item.0.0.0.count', path: ['sections', 0, 'groups', 0, 'promptItems', 0, 'prefill', 'bank', 'count'], value: 5},
      {method: 'setValue', focus: 'item.0.0.0.fixedBy', path: ['sections', 0, 'groups', 0, 'promptItems', 0, 'prefill', 'bank', 'fixedBy'], value: 'SPEAKER'},
      {method: 'setValue', focus: 'item.0.0.0.itemcodePrefix', path: ['sections', 0, 'groups', 0, 'promptItems', 0, 'prefill', 'bank', 'itemcodePrefix'], value: 'RB'},
    ]);
  });

  it('previews generated codes with the frozen padding and cap', () => {
    const {component} = mount({script: drawnCount(2), selection});
    expect(component.prefixPreview(component.itemBank())).toContain('RB001');
    expect(component.prefixPreview({bank: 'b', bankSource: 'PROJECT', count: 1200, itemcodePrefix: 'X'})).toContain('X999');
    expect(component.prefillFormatPreview('6.{n}')).toContain('6.1');
  });

  it('suspends the count when the bank cannot be read', () => {
    const {component} = mount({script: drawnCount(2), selection});
    expect(component.countSuspended()).toBe(true);
    expect(component.countMessage()).toContain('cannot be validated');
  });

  it('flags E04 when count exceeds the bank match count', () => {
    const view: BankView = {bankId: 'words', items: [{bankItemId: '1'}, {bankItemId: '2'}]};
    const {component} = mount({script: drawnCount(4), selection, bankViews: new Map([['words', view]])});
    expect(component.countSuspended()).toBe(false);
    expect(component.countExceeds()).toBe(true);
    expect(component.countMessage()).toContain('2');
  });
});
