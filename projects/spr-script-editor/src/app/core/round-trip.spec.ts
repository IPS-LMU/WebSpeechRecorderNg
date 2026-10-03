/**
 * Editor → library round-trip over every fixture (M3 gate).
 *
 * The editor loads a script, the screens edit it, and the draft service serialises it back. Three
 * properties must hold for every fixture in the tree, because a script nobody fixed must come back
 * out unchanged:
 *
 * 1. no key is lost — the written value deep-equals the file it came from;
 * 2. a legacy `promptUnits` section gains no `groups` (data-model §4 invariant 10, A4/D-M);
 * 3. the loader's `_shuffled*` mirrors are **never** persisted (they are a view, and the recorder
 *    rebuilds them at load).
 *
 * The fixtures are the ones the project serves at `/test` (angular.json's assets in both the build
 * and the karma target), so this runs against exactly what `ApiType.FILES` shows in development.
 */
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {ApiType, SPEECHRECORDER_CONFIG} from 'speechrecorderng';
import {ScriptApiService} from './script-api.service';
import {ScriptDraftService} from './script-draft.service';

const BASE = '/test';
const PROJECT = 'Demo1';

interface Fixture {
  id: string;
  text: string;
  value: Record<string, unknown>;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  }
}

/** Every script of the project's list fixture, with its bytes and parsed value. */
async function fixtures(): Promise<Array<Fixture>> {
  const listText = await fetchText(`${BASE}/project/${PROJECT}/script.json`);
  if (listText === null) {
    throw new Error(`the fixture list ${BASE}/project/${PROJECT}/script.json is not served — check the karma assets`);
  }
  const rows = JSON.parse(listText) as Array<Record<string, unknown>>;
  const out: Array<Fixture> = [];
  for (const row of rows) {
    const id = String(row['scriptId']);
    const text = await fetchText(`${BASE}/script/${id}.json`);
    if (text === null) {
      continue;
    }
    out.push({id, text, value: JSON.parse(text) as Record<string, unknown>});
  }
  return out;
}

/** Loads `text` through the draft service the way the editor screen does. */
async function loadThroughDraftService(projectId: string, scriptId: string, text: string, etag: string) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {provide: SPEECHRECORDER_CONFIG, useValue: {apiEndPoint: 'api/v1', apiType: ApiType.NORMAL, apiVersion: 1}},
      ScriptApiService,
    ],
  });
  const service = TestBed.inject(ScriptDraftService);
  const http = TestBed.inject(HttpTestingController);
  const loading = service.load(projectId, scriptId);
  http
    .expectOne((request) => request.method === 'GET' && request.urlWithParams.split('?')[0].endsWith('/draft'))
    .flush(text, {headers: {ETag: etag}});
  await loading;
  http.verify();
  return service;
}

describe('editor → library round-trip', () => {
  it('writes every fixture back without losing a key', async () => {
    const all = await fixtures();
    expect(all.length).withContext('no fixtures were loaded').toBeGreaterThan(0);
    for (const fixture of all) {
      const service = await loadThroughDraftService(PROJECT, fixture.id, fixture.text, '"fixture"');
      const written = JSON.parse(service.text()) as Record<string, unknown>;
      expect(written).withContext(`${fixture.id} lost or changed a value`).toEqual(fixture.value);
      expect(service.text()).withContext(`${fixture.id} persisted the loader's mirrors`).not.toContain('_shuffled');
    }
  });

  it('keeps a legacy promptUnits section free of a fabricated groups key', async () => {
    const all = await fixtures();
    const legacy = all.filter((fixture) =>
      (fixture.value['sections'] as Array<Record<string, unknown>> | undefined)?.some(
        (section) => section['promptUnits'] !== undefined && section['groups'] === undefined,
      ),
    );
    expect(legacy.length).withContext('no legacy promptUnits fixture in the tree').toBeGreaterThan(0);
    for (const fixture of legacy) {
      const service = await loadThroughDraftService(PROJECT, fixture.id, fixture.text, '"fixture"');
      const written = JSON.parse(service.text()) as {sections: Array<Record<string, unknown>>};
      for (const [index, section] of (fixture.value['sections'] as Array<Record<string, unknown>>).entries()) {
        if (section['promptUnits'] === undefined) {
          continue;
        }
        expect(written.sections[index]['groups'])
          .withContext(`${fixture.id} section ${index} invented a groups key`)
          .toBeUndefined();
        expect(written.sections[index]['promptUnits'])
          .withContext(`${fixture.id} section ${index} changed promptUnits`)
          .toEqual(section['promptUnits']);
      }
    }
  });

  it('fills the shuffled mirrors the screens read', async () => {
    const all = await fixtures();
    const modern = all.find((fixture) =>
      (fixture.value['sections'] as Array<Record<string, unknown>> | undefined)?.some(
        (section) => Array.isArray(section['groups']),
      ),
    );
    expect(modern).withContext('no modern fixture in the tree').toBeDefined();
    const service = await loadThroughDraftService(PROJECT, modern!.id, modern!.text, '"fixture"');
    const model = service.model() as {sections: Array<Record<string, unknown>>};
    const section = model.sections.find((candidate) => Array.isArray(candidate['groups']));
    expect(section).toBeDefined();
    expect(section!['_shuffledGroups']).withContext('the outline walks _shuffledGroups').toBe(section!['groups']);
  });
});
