import type {DrawPage, SessionDrawTrace} from '../core/script.model';
import {
  csvField,
  filterParts,
  firstItemcodes,
  parseDrawPage,
  parseSessionTrace,
  redrawEnablement,
  statusKind,
  toCsv,
  traceNotes,
} from './draws-map';

/** The receiver's draw record for the seeded `bank-draw` script (probed against it, rest-api §4.2). */
const PAGE: DrawPage = {
  total: 1,
  rows: [
    {
      sessionId: 'bank-draw--s1',
      speaker: null,
      status: 'CREATED',
      preview: false,
      scriptVersion: null,
      drawnDate: '2026-10-03T16:32:44.796Z',
      bank: 'std-passages',
      bankSource: 'BUILTIN',
      drawn: 2,
      recorded: 0,
      items: [
        {itemcode: 'RB001', bankItemId: 'std-001', recorded: false},
        {itemcode: 'RB002', bankItemId: 'std-002', recorded: false},
      ],
    },
  ],
};

const TRACE = {
  sessionId: 'bank-draw--s1',
  script: 'bank-draw',
  scriptVersion: null,
  drawnDate: '2026-10-03T16:32:44.796Z',
  redraw: 0,
  prefills: {},
  bankDraws: [
    {
      kind: 'bank',
      placeholderItemcode: 'RB',
      bank: 'std-passages',
      bankSource: 'BUILTIN',
      filter: {category: 'sentence'},
      count: 2,
      fixedBy: 'SESSION',
      key: 'session:bank-draw--s1',
      itemcodePrefix: 'RB',
      items: [
        {itemcode: 'RB001', bankItemId: 'std-001'},
        {itemcode: 'RB002', bankItemId: 'std-002'},
      ],
      refilled: false,
      skippedRecorded: false,
      speakerFallback: false,
      drawnForVersion: null,
    },
  ],
} as unknown as SessionDrawTrace;

describe('draws record mapping', () => {
  it('turns the receiver page into rows, keeping the recorded flags and the preview flag', () => {
    const rows = parseDrawPage(PAGE);

    expect(rows).toHaveSize(1);
    expect(rows[0].sessionId).toBe('bank-draw--s1');
    expect(rows[0].speaker).toBeNull();
    expect(rows[0].status).toBe('CREATED');
    expect(rows[0].preview).toBe(false);
    expect(rows[0].bank).toBe('std-passages');
    expect(rows[0].bankSource).toBe('BUILTIN');
    expect(rows[0].drawn).toBe(2);
    expect(rows[0].items.map((item) => item.itemcode)).toEqual(['RB001', 'RB002']);
    expect(rows[0].items.map((item) => item.recorded)).toEqual([false, false]);
  });

  it('derives the counts when the receiver omits them, and never invents a missing field', () => {
    const rows = parseDrawPage({total: 1, rows: [{sessionId: 7, status: 'STARTED'}]} as DrawPage);

    expect(rows[0].sessionId).toBe('7');
    expect(rows[0].drawn).toBe(0);
    expect(rows[0].recorded).toBe(0);
    expect(rows[0].speaker).toBeNull();
    expect(rows[0].bank).toBeNull();
    expect(rows[0].scriptVersion).toBeNull();
  });

  it('maps the session trace: seed key, fixedBy, refill and fallback flags, timestamps', () => {
    const trace = parseSessionTrace(TRACE);
    const draw = trace.bankDraws[0];

    expect(trace.sessionId).toBe('bank-draw--s1');
    expect(trace.script).toBe('bank-draw');
    expect(trace.drawnDate).toBe('2026-10-03T16:32:44.796Z');
    expect(trace.redraw).toBe(0);
    expect(draw.placeholderItemcode).toBe('RB');
    expect(draw.bank).toBe('std-passages');
    expect(draw.bankSource).toBe('BUILTIN');
    expect(draw.count).toBe(2);
    expect(draw.fixedBy).toBe('SESSION');
    expect(draw.key).toBe('session:bank-draw--s1');
    expect(draw.itemcodePrefix).toBe('RB');
    expect(draw.items.map((item) => item.bankItemId)).toEqual(['std-001', 'std-002']);
    expect(draw.refilled).toBe(false);
    expect(draw.skippedRecorded).toBe(false);
    expect(draw.speakerFallback).toBe(false);
    // The session trace carries no recording flag; the record does (see the page mapping above).
    expect(draw.items.every((item) => item.recorded === null)).toBe(true);
  });

  it('reads the list-source prefills as well as the bank draws', () => {
    const trace = parseSessionTrace({
      sessionId: 's1',
      prefills: {'W1': {source: 'sti-wordlists', list: '2'}},
      bankDraws: [],
    } as SessionDrawTrace);

    expect(trace.listDraws).toEqual([
      {kind: 'list', placeholderItemcode: 'W1', source: 'sti-wordlists', list: '2'},
    ]);
    expect(trace.bankDraws).toHaveSize(0);
  });

  it('labels the session statuses the recorder writes', () => {
    expect(statusKind('CREATED')).toBe('created');
    expect(statusKind('LOADED')).toBe('loaded');
    expect(statusKind('STARTED_TRAINING')).toBe('training');
    expect(statusKind('STARTED')).toBe('started');
    expect(statusKind('COMPLETED')).toBe('completed');
    expect(statusKind(null)).toBe('unknown');
    expect(statusKind('SOMETHING_ELSE')).toBe('unknown');
  });

  it('enables re-draw only for a session that has not started', () => {
    expect(redrawEnablement('CREATED')).toEqual({enabled: true, reason: 'created'});
    expect(redrawEnablement('STARTED')).toEqual({enabled: false, reason: 'started'});
    expect(redrawEnablement('STARTED_TRAINING')).toEqual({enabled: false, reason: 'started'});
    expect(redrawEnablement('COMPLETED')).toEqual({enabled: false, reason: 'started'});
    expect(redrawEnablement(null)).toEqual({enabled: false, reason: 'started'});
    // Fixture mode cannot answer the write at all, whatever the status says.
    expect(redrawEnablement('CREATED', {readOnly: true})).toEqual({enabled: false, reason: 'readOnly'});
  });

  it('shows a few itemcodes and counts the rest', () => {
    const items = parseDrawPage(PAGE)[0].items;
    expect(firstItemcodes(items)).toBe('RB001, RB002');
    expect(firstItemcodes([...items, ...items, ...items].slice(0, 6))).toBe('RB001, RB002, RB001, RB002 +2');
    expect(firstItemcodes([])).toBe('');
  });

  it('describes the persisted filter without inventing semantics', () => {
    expect(filterParts({category: 'sentence', words: [6, 12], hasAudio: false, q: 'bench', tags: ['a', 'b']}))
      .toEqual([
        {key: 'category', value: 'sentence'},
        {key: 'words', value: '6\u201312'},
        {key: 'audio', value: 'without'},
        {key: 'q', value: 'bench'},
        {key: 'tags', value: 'a, b'},
      ]);
    expect(filterParts({})).toEqual([]);
    expect(filterParts({hasAudio: true})).toEqual([{key: 'audio', value: 'with'}]);
  });

  it('derives the session-case notes from the trace flags', () => {
    expect(traceNotes(parseSessionTrace(TRACE))).toEqual([]);

    const noted = parseSessionTrace({
      sessionId: 's1',
      redraw: 1,
      bankDraws: [{bank: 'b', items: [], refilled: true, skippedRecorded: true, speakerFallback: true}],
    } as SessionDrawTrace);
    expect(traceNotes(noted)).toEqual(['skippedRecorded', 'refilled', 'speakerFallback', 'redrawn']);
  });
});

describe('draws CSV derivation', () => {
  it('writes the receiver\u2019s bytes: header, one row per item, LF, trailing newline', () => {
    // Byte-for-byte what the seeded receiver answered for the same record (Accept: text/csv).
    expect(toCsv(parseDrawPage(PAGE))).toBe(
      'sessionId,speaker,itemcode,bankItemId,recorded\n' +
      'bank-draw--s1,,RB001,std-001,false\n' +
      'bank-draw--s1,,RB002,std-002,false\n',
    );
  });

  it('carries the recorded flag and the speaker of every row it renders', () => {
    const rows = parseDrawPage({
      total: 1,
      rows: [{
        sessionId: 's2',
        speaker: 'sp-13',
        status: 'STARTED',
        items: [
          {itemcode: 'RB001', bankItemId: 'std-001', recorded: true},
          {itemcode: 'RB002', bankItemId: 'std-002', recorded: false},
        ],
      }],
    } as DrawPage);

    expect(toCsv(rows)).toBe(
      'sessionId,speaker,itemcode,bankItemId,recorded\n' +
      's2,sp-13,RB001,std-001,true\n' +
      's2,sp-13,RB002,std-002,false\n',
    );
  });

  it('quotes fields the receiver would quote, and nothing else', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('sp,13')).toBe('"sp,13"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField(null)).toBe('');
  });
});
