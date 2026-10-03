import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {Router, provideRouter, withComponentInputBinding} from '@angular/router';
import {RouterTestingHarness} from '@angular/router/testing';
import {ApiType, SPEECHRECORDER_CONFIG} from 'speechrecorderng';
import {MediaService} from '../core/media.service';
import {ScriptApiService} from '../core/script-api.service';
import {ScriptPreview} from './script-preview';

function pathOf(urlWithParams: string): string {
  return urlWithParams.split('?')[0];
}

const SCRIPT = {
  type: 'script',
  scriptId: 'demo',
  name: 'Demo script',
  sections: [
    {
      name: 'Warm-up',
      promptphase: 'IDLE',
      training: true,
      groups: [
        {
          order: 'SEQUENTIAL',
          promptItems: [
            {
              itemcode: 'W1',
              mediaitems: [
                {mimetype: 'text/plain', text: 'Say hello.'},
                {mimetype: 'audio/wav', src: 'media/model-01.wav'},
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'Vowels',
      promptphase: 'RECORDING',
      training: false,
      groups: [
        {
          order: 'RANDOMIZED',
          promptItems: [
            {
              itemcode: 'V1',
              mediaitems: [
                {mimetype: 'text/plain', text: 'Say a.'},
                {mimetype: 'audio/wav', src: 'media/gone.wav'},
              ],
              playback: {when: 'DURING', replayable: true, maxReplays: 1},
            },
            {
              itemcode: 'D',
              mediaitems: [{mimetype: 'text/plain', text: 'Repeat the vowel {entry} after the model.'}],
              prefill: {
                bank: {
                  bank: 'std-passages',
                  bankSource: 'BUILTIN',
                  count: 2,
                  itemcodePrefix: 'D',
                  playBankAudio: true,
                  playback: {when: 'ONDEMAND', replayable: true},
                },
              },
            },
          ],
        },
      ],
    },
  ],
};

/** One file: `media/gone.wav` is deliberately absent, so the stage must label it. */
const MEDIA = [{src: 'media/model-01.wav', name: 'model-01.wav', mimetype: 'audio/wav', durationMs: 1000}];

interface Harness {
  harness: RouterTestingHarness;
  root: HTMLElement;
}

/** Mounts the preview through its real route, with the inputs the router binds. */
async function setup(url: string): Promise<Harness> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        [{path: 'project/:p/script/:id/preview', component: ScriptPreview}],
        withComponentInputBinding(),
      ),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: SPEECHRECORDER_CONFIG,
        useValue: {apiEndPoint: 'test', apiType: ApiType.FILES, apiVersion: 1, withCredentials: true},
      },
      ScriptApiService,
      MediaService,
    ],
  });
  const harness = await RouterTestingHarness.create(url);
  const http = TestBed.inject(HttpTestingController);
  http.expectOne((request) => pathOf(request.urlWithParams) === 'test/script/demo.json').flush(SCRIPT);
  http.expectOne((request) => pathOf(request.urlWithParams) === 'test/project/Demo1/media.json').flush(MEDIA);
  harness.detectChanges();
  return {harness, root: harness.routeNativeElement as HTMLElement};
}

async function click(state: Harness, element: Element | null): Promise<void> {
  expect(element).withContext('the control exists').not.toBeNull();
  (element as HTMLElement).click();
  await state.harness.fixture.whenStable();
  state.harness.detectChanges();
}

function texts(state: Harness, selector: string): string[] {
  return Array.from(state.root.querySelectorAll(selector)).map((element) => element.textContent?.trim() ?? '');
}

describe('ScriptPreview (tier 1)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('renders the banner, the tier-2 dry run slot and the speaker frame', async () => {
    const state = await setup('/project/Demo1/script/demo/preview');

    const banner = state.root.querySelector('.banner')?.textContent ?? '';
    expect(banner).toContain('Nothing is recorded or uploaded');

    // Fixture mode cannot reach a receiver, so the dry run is present but disabled with its reason.
    const dryRun = state.root.querySelector('.tier2-start') as HTMLButtonElement;
    expect(dryRun.disabled).toBe(true);
    expect(dryRun.getAttribute('title')).toContain('development fixtures');
    expect(state.root.querySelector('.tier2-reason')?.textContent).toContain('development fixtures');

    expect(state.root.querySelector('#frame-section')?.textContent).toContain('Warm-up');
    expect(state.root.querySelector('.progress')?.textContent).toContain('Item 1 of 4 · 2 drawn');
    expect(texts(state, '.chip')).toEqual(['Practice']);
    expect(state.root.querySelector('.prompt-text')?.textContent).toContain('Say hello.');
    expect(state.root.querySelector('.media-audio')?.textContent).toContain('media/model-01.wav');
    expect(texts(state, '.step-name')).toEqual(['Idle', 'Listening', 'Pre-rec', 'Recording', 'Post-rec']);
    expect(texts(state, '.timing dt').length).toBeGreaterThan(0);
  });

  it('folds the example draw into the order list, marked as drawn', async () => {
    const state = await setup('/project/Demo1/script/demo/preview');

    expect(texts(state, 'li[data-kind="drawn"] .row-label')).toEqual(['D001', 'D002']);
    expect(texts(state, 'li[data-kind="drawn"] .mark')).toEqual(['drawn', 'drawn']);
    expect(state.root.querySelector('li[data-kind="drawn-group"] .row-label')?.textContent)
      .toContain('Drawn group: 2 × std-passages');
  });

  it('re-draws a different example for the same drawn items', async () => {
    const state = await setup('/project/Demo1/script/demo/preview');
    const before = texts(state, 'li[data-kind="drawn"] .row-detail');

    await click(state, state.root.querySelector('.order-head button'));

    const after = texts(state, 'li[data-kind="drawn"] .row-detail');
    expect(texts(state, 'li[data-kind="drawn"] .row-label')).toEqual(['D001', 'D002']);
    expect(after).not.toEqual(before);
    expect(after.every((entry) => entry.length > 0)).toBe(true);
  });

  it('labels a missing playback file instead of leaving a silent gap', async () => {
    const state = await setup('/project/Demo1/script/demo/preview?item=s1g0i0');

    const missing = state.root.querySelector('.media-missing');
    expect(missing?.textContent).toContain('Playback file not found');
    expect(missing?.textContent).toContain('media/gone.wav');
    expect(state.root.querySelector('.media-audio')).toBeNull();
  });

  it('marks a drawn row, plays the operator its bank recording label and withholds the section chip', async () => {
    const state = await setup('/project/Demo1/script/demo/preview?item=s1g0i1-d1');

    expect(state.root.querySelector('.chip-drawn')?.textContent).toContain('Drawn item');
    expect(state.root.querySelector('.chip-practice')).toBeNull();
    expect(state.root.querySelector('.media-bank')?.textContent)
      .toContain('Bank model recording — resolved when the session runs');
    expect(state.root.querySelector('.progress')?.textContent).toContain('Item 4 of 4 · 2 drawn');
    expect(state.root.querySelector('li.selected .row-label')?.textContent).toContain('D002');
  });

  it('disables the steps the selected item cannot reach', async () => {
    const state = await setup('/project/Demo1/script/demo/preview?item=s1g0i1-d0');
    const steps = Array.from(state.root.querySelectorAll('.step')) as HTMLButtonElement[];

    // The drawn item's sound is ON DEMAND: only the operator starts it, so Listening is off.
    const listening = steps.find((step) => step.textContent?.includes('Listening')) as HTMLButtonElement;
    expect(listening.disabled).toBe(true);
    expect(listening.getAttribute('title')).toContain('operator');
    expect(steps.filter((step) => step.disabled)).toHaveSize(1);

    // A recording item: Recording and the take steps are available.
    const recording = steps.find((step) => step.textContent?.includes('Recording')) as HTMLButtonElement;
    expect(recording.disabled).toBe(false);
  });

  it('moves the simulation, the lamps and the URL when a step is chosen', async () => {
    const state = await setup('/project/Demo1/script/demo/preview');
    const listening = Array.from(state.root.querySelectorAll('.step'))
      .find((step) => step.textContent?.includes('Listening')) as HTMLButtonElement;

    await click(state, listening);

    expect(TestBed.inject(Router).url).toContain('step=LISTENING');
    expect(state.root.querySelector('.lamp-playback.lit')).not.toBeNull();
    expect(state.root.querySelector('.status')?.textContent).toContain('Playing the prompt sound');
    expect(state.root.querySelector('.level-segment.lit')).not.toBeNull();
    expect(listening.getAttribute('aria-checked')).toBe('true');
  });

  it('caps the replays the item allows', async () => {
    const state = await setup('/project/Demo1/script/demo/preview?item=s1g0i0');
    const replay = state.root.querySelector('.replay button') as HTMLButtonElement;

    expect(replay.disabled).toBe(false);
    expect(state.root.querySelector('.replay-count')?.textContent).toContain('0 / 1');

    await click(state, replay);

    expect(state.root.querySelector('.replay-count')?.textContent).toContain('1 / 1');
    expect((state.root.querySelector('.replay button') as HTMLButtonElement).disabled).toBe(true);
    expect(state.root.querySelector('.replay button')?.getAttribute('title')).toContain('caps its replays');
  });

  it('reports a script the server could not deliver instead of an empty frame', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [{path: 'project/:p/script/:id/preview', component: ScriptPreview}],
          withComponentInputBinding(),
        ),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: SPEECHRECORDER_CONFIG,
          useValue: {apiEndPoint: 'test', apiType: ApiType.FILES, apiVersion: 1, withCredentials: true},
        },
        ScriptApiService,
        MediaService,
      ],
    });
    const harness = await RouterTestingHarness.create('/project/Demo1/script/demo/preview');
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((request) => pathOf(request.urlWithParams) === 'test/script/demo.json')
      .flush('not found', {status: 404, statusText: 'Not Found'});
    http.expectOne((request) => pathOf(request.urlWithParams) === 'test/project/Demo1/media.json').flush(MEDIA);
    harness.detectChanges();

    const root = harness.routeNativeElement as HTMLElement;
    expect(root.querySelector('.state-error')?.textContent).toContain('The script could not be loaded.');
    expect(root.querySelector('.state-error')?.textContent).toContain('404');
    expect(root.querySelector('.speaker-frame')).toBeNull();
  });
});
