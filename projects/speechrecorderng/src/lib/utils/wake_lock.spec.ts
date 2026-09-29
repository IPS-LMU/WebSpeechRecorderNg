import {WakeLockManager} from "./wake_lock";

/** Lets the promise chain of a request settle. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** What the browser hands out for `navigator.wakeLock.request('screen')`. */
class FakeSentinel extends EventTarget {
  released = false;

  release(): Promise<void> {
    this.released = true;
    this.dispatchEvent(new Event('release'));
    return Promise.resolve();
  }
}

class FakeWakeLock {
  readonly requests: Array<{resolve: (sentinel: WakeLockSentinel) => void, reject: (reason: unknown) => void}> = [];

  request(): Promise<WakeLockSentinel> {
    // The project's `lib` is es2018: `Promise.withResolvers` (es2024) is not available here.
    return new Promise<WakeLockSentinel>((resolve, reject) => {
      this.requests.push({resolve, reject});
    });
  }

  get count(): number {
    return this.requests.length;
  }

  grant(sentinel = new FakeSentinel()): FakeSentinel {
    this.requests[this.requests.length - 1].resolve(sentinel as unknown as WakeLockSentinel);
    return sentinel;
  }

  deny(reason: unknown = new Error('Wake Lock permission request denied')): void {
    this.requests[this.requests.length - 1].reject(reason);
  }
}

describe('WakeLockManager', () => {
  let wakeLock: FakeWakeLock;
  let manager: WakeLockManager;
  let states: boolean[];
  let errors: unknown[];

  beforeEach(() => {
    wakeLock = new FakeWakeLock();
    // Headless Chrome and any other browser expose the API; the fake replaces the real request.
    Object.defineProperty(navigator, 'wakeLock', {value: wakeLock, configurable: true});
    manager = new WakeLockManager();
    states = [];
    errors = [];
    manager.behaviorSubject.subscribe({next: (value) => states.push(value), error: (reason) => errors.push(reason)});
    // A BehaviorSubject replays its current value on subscribe; the assertions are about what the
    // manager reports from here on.
    states.length = 0;
  });

  afterEach(() => {
    delete (navigator as {wakeLock?: unknown}).wakeLock;
  });

  it('reports a denied request as not locked, without ending the stream', async () => {
    manager.enableWakeLock();
    wakeLock.deny();
    await settle();
    expect(states).toEqual([false]);
    expect(errors).toEqual([]);

    // The denial is not terminal: the next take asks again and the indicator turns on.
    manager.enableWakeLock();
    wakeLock.grant();
    await settle();
    expect(states).toEqual([false, true]);
    expect(errors).toEqual([]);
  });

  it('releases the lock it holds, and is safe when it holds none', async () => {
    manager.enableWakeLock();
    const sentinel = wakeLock.grant();
    await settle();
    expect(states).toEqual([true]);

    manager.disableWakeLock();
    await settle();
    expect(sentinel.released).toBe(true);
    expect(states).toEqual([true, false]);

    // A denied lock left no sentinel: releasing again must not throw.
    manager.disableWakeLock();
    await settle();
    expect(states).toEqual([true, false, false]);
    expect(errors).toEqual([]);
  });

  it('keeps one lock while one is held', async () => {
    manager.enableWakeLock();
    wakeLock.grant();
    await settle();
    manager.enableWakeLock();
    manager.enableWakeLock();
    await settle();
    expect(wakeLock.count).toBe(1);
    expect(states).toEqual([true]);

    manager.disableWakeLock();
    await settle();
    manager.enableWakeLock();
    expect(wakeLock.count).toBe(2);
  });

  it('does not repeat the request while one is in flight', async () => {
    manager.enableWakeLock();
    manager.enableWakeLock();
    expect(wakeLock.count).toBe(1);
    wakeLock.grant();
    await settle();
    expect(states).toEqual([true]);
  });

  it('releases a lock that arrives after the caller gave up', async () => {
    manager.enableWakeLock();
    manager.disableWakeLock();
    const sentinel = wakeLock.grant();
    await settle();
    expect(sentinel.released).toBe(true);
    expect(states).toEqual([false]);   // never reported as locked
  });

  it('reports a lock the browser revokes by itself', async () => {
    manager.enableWakeLock();
    const sentinel = wakeLock.grant();
    await settle();
    expect(states).toEqual([true]);

    // The browser releases the sentinel when the document becomes hidden.
    sentinel.dispatchEvent(new Event('release'));
    expect(states).toEqual([true, false]);

    // And a later release of the same sentinel does not report twice.
    manager.disableWakeLock();
    await settle();
    expect(states).toEqual([true, false, false]);
  });
});
