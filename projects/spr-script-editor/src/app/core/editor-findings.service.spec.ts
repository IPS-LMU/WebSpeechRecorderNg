/**
 * The debounce policy of `EditorFindingsService` (plan M5 perf): a burst of model changes runs the
 * catalogue once after the quiet period; a discrete action runs it immediately; a queued run can
 * never clobber a newer immediate one; a destroyed screen cancels its pending run.
 *
 * The catalogue's property reads over the draft are counted with a `Proxy`, so "one recompute" is
 * an exact count rather than an inference from the final value.
 */
import {EditorFindingsService, FINDINGS_DEBOUNCE_MS} from './editor-findings.service';
import {runChecks, type Draft} from './validation';

/** A draft that counts the property reads a catalogue run makes over it. */
function countedDraft(counter: {reads: number}): Draft {
  return new Proxy(
    {name: 'x', sections: []} as Record<string, unknown>,
    {
      get(target, key, receiver) {
        counter.reads++;
        return Reflect.get(target, key, receiver);
      },
    },
  );
}

/** The reads one catalogue pass makes over a draft of `countedDraft`'s shape. */
function readsPerRun(): number {
  const counter = {reads: 0};
  runChecks(countedDraft(counter));
  return counter.reads;
}

describe('EditorFindingsService debounce', () => {
  let service: EditorFindingsService;

  beforeEach(() => {
    jasmine.clock().install();
    service = new EditorFindingsService();
  });

  afterEach(() => {
    service.cancelPending();
    jasmine.clock().uninstall();
  });

  it('runs the catalogue once for a burst of model changes, on the last draft', () => {
    const perRun = readsPerRun();
    const counter = {reads: 0};

    for (let edit = 0; edit < 20; edit++) {
      service.scheduleClient(countedDraft(counter));
    }
    expect(counter.reads).toBe(0);

    jasmine.clock().tick(FINDINGS_DEBOUNCE_MS - 1);
    expect(counter.reads).toBe(0);

    jasmine.clock().tick(1);
    expect(counter.reads).toBe(perRun);
    expect(service.client()).toEqual(runChecks({name: 'x', sections: []}));
  });

  it('runs the catalogue immediately for a discrete action and drops the queued run', () => {
    const counter = {reads: 0};
    service.scheduleClient(countedDraft(counter));
    const discrete = {name: 'x', sections: []};

    service.refresh(discrete);

    expect(service.client()).toEqual(runChecks(discrete));
    // The queued run is gone: letting time pass never reads its draft.
    jasmine.clock().tick(FINDINGS_DEBOUNCE_MS * 2);
    expect(counter.reads).toBe(0);
  });

  it('a stale scheduled run cannot clobber a newer immediate one', () => {
    // The race the generation guards: the queued timer still fires after it was superseded.
    const realClearTimeout = window.clearTimeout;
    window.clearTimeout = () => undefined;
    try {
      const stale = {reads: 0};
      const fresh = {name: 'x', sections: []};
      service.scheduleClient(countedDraft(stale));
      service.refresh(fresh);

      jasmine.clock().tick(FINDINGS_DEBOUNCE_MS);

      expect(service.client()).toEqual(runChecks(fresh));
      expect(stale.reads).toBe(0);
    } finally {
      window.clearTimeout = realClearTimeout;
    }
  });

  it('cancels a pending run when the screen is destroyed', () => {
    const counter = {reads: 0};
    service.scheduleClient(countedDraft(counter));

    service.cancelPending();
    jasmine.clock().tick(FINDINGS_DEBOUNCE_MS * 2);

    expect(counter.reads).toBe(0);
    expect(service.client()).toEqual([]);
  });

  it('does not re-schedule a draft/context already reflected in the findings', () => {
    const counter = {reads: 0};
    const perRun = readsPerRun();
    const draft = countedDraft(counter);
    const context = {};
    service.refresh(draft, context);

    // The effect of a discrete action hands over the same pair again: nothing to do.
    service.scheduleClient(draft, context);
    jasmine.clock().tick(FINDINGS_DEBOUNCE_MS * 2);

    expect(counter.reads).toBe(perRun);
  });

  it('recompute re-runs the latest draft the screen handed over', () => {
    const perRun = readsPerRun();
    const counter = {reads: 0};
    service.refresh(countedDraft(counter));
    expect(counter.reads).toBe(perRun);

    service.recompute();

    expect(counter.reads).toBe(perRun * 2);
  });
});
