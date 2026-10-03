import {serverFindingsFrom} from './server-findings';

describe('serverFindingsFrom', () => {
  it('maps a bare details.checks array, defaulting the message and the severity', () => {
    const findings = serverFindingsFrom([
      {id: 'E02', path: 'sections[0].groups[0].promptItems[1].itemcode'},
      {id: 'N04', path: 'name'},
    ]);
    expect(findings.length).toBe(2);
    expect(findings[0]).toEqual({
      id: 'E02',
      severity: 'error',
      path: 'sections[0].groups[0].promptItems[1].itemcode',
      message: 'The server refused this check (E02).',
    });
    expect(findings[1].severity).toBe('note');
  });

  it('keeps the server message and severity when present', () => {
    const findings = serverFindingsFrom({checks: [{id: 'E04', path: 'x', severity: 'warning', message: 'Bank shrank.'}]});
    expect(findings).toEqual([{id: 'E04', severity: 'warning', path: 'x', message: 'Bank shrank.'}]);
  });

  it('ignores malformed entries and non-array payloads', () => {
    expect(serverFindingsFrom(null)).toEqual([]);
    expect(serverFindingsFrom({error: 'nope'})).toEqual([]);
    expect(serverFindingsFrom([null, {path: 'no id'}, {id: ''}])).toEqual([]);
    expect(serverFindingsFrom({checks: [{id: 'W11'}]})[0].path).toBe('');
  });
});
