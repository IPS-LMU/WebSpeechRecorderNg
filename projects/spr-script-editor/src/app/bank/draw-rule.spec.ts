import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {firstValueFrom, timer} from 'rxjs';
import {ApiType, type Bank, type PrefillBankSource, SPEECHRECORDER_CONFIG} from 'speechrecorderng';
import {BankApiService} from '../core/bank-api.service';
import {BankItemPage} from '../core/script.model';
import {EDITOR_STRINGS} from '../core/editor-strings';
import {BANK_STRINGS} from './bank-strings';
import {DrawRulePanel} from './draw-rule';

const BANK: Bank = {
  bankId: 'std-passages',
  title: 'Standard passages and vowels',
  source: 'BUILTIN',
  shippedWith: '3.12',
  itemCount: 6,
};

const RULE: PrefillBankSource = {
  bank: 'std-passages',
  bankSource: 'BUILTIN',
  filter: {category: 'sentence'},
  count: 2,
  order: 'SEQUENTIAL',
  fixedBy: 'SESSION',
  itemcodePrefix: 'RB',
  playBankAudio: true,
};

const PAGE: BankItemPage = {
  matchCount: 4,
  withoutAudio: 1,
  offset: 0,
  items: [
    {bankItemId: 'std-001', text: 'One.', category: 'sentence', words: 7, tags: ['read'], audioSrc: 'media/a.wav'},
    {bankItemId: 'std-002', text: 'Two.', category: 'sentence', words: 6, tags: ['read']},
    {bankItemId: 'std-003', text: 'Three.', category: 'sentence', words: 5, tags: ['read']},
    {bankItemId: 'std-004', text: 'Four.', category: 'sentence', words: 5, tags: ['read']},
  ],
};

function pathOf(urlWithParams: string): string {
  return urlWithParams.split('?')[0];
}

function queryOf(urlWithParams: string): URLSearchParams {
  return new URLSearchParams(urlWithParams.split('?')[1] ?? '');
}

async function mount(rule: PrefillBankSource = RULE, banks: ReadonlyArray<Bank> = [BANK]) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: SPEECHRECORDER_CONFIG,
        useValue: {apiEndPoint: 'api/v1', apiType: ApiType.NORMAL, apiVersion: 1},
      },
      BankApiService,
    ],
  });
  const fixture = TestBed.createComponent(DrawRulePanel);
  fixture.componentRef.setInput('project', 'Demo1');
  fixture.componentRef.setInput('source', rule);
  fixture.componentRef.setInput('banks', banks);
  fixture.componentRef.setInput('bank', banks.find((bank) => bank.bankId === rule.bank) ?? null);
  fixture.detectChanges();
  await settle(fixture);
  return {fixture, http: TestBed.inject(HttpTestingController)};
}

/** Past the counts’ 120 ms debounce, then settled. */
async function settle(fixture: {detectChanges: () => void; whenStable: () => Promise<unknown>}): Promise<void> {
  await firstValueFrom(timer(160));
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function root(fixture: {nativeElement: unknown}): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

describe('DrawRulePanel', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('queries the frozen filter, shows the summary, the codes and a clearly-labelled example', async () => {
    const {fixture, http} = await mount();

    const request = http.expectOne((req) => pathOf(req.urlWithParams) === 'api/v1/project/Demo1/bank/std-passages/item');
    const query = queryOf(request.request.urlWithParams);
    expect(query.get('category')).toBe('sentence');
    expect(query.get('limit')).toBe('999');
    request.flush(PAGE);
    fixture.detectChanges();

    const text = root(fixture).textContent ?? '';
    expect(text).toContain(BANK_STRINGS.rule.heading);
    expect(text).toContain(EDITOR_STRINGS.inspector.group.drawOnce);
    expect(text).toContain(EDITOR_STRINGS.centre.bankOriginBuiltin);
    // The read-only filter summary, from the one shared implementation.
    expect(root(fixture).querySelector('.summary-value')?.textContent).toContain('category sentence');
    // The generated itemcode preview.
    expect(root(fixture).querySelector('.codes')?.textContent).toContain('RB001…RB002 (2)');
    // The example is labelled and sampled, and its note states what it ignores.
    expect(root(fixture).querySelector('.example')?.textContent).toContain('ignores');
    expect(Array.from(root(fixture).querySelectorAll('.example-list li')).map((li) => li.textContent?.trim()))
      .toHaveSize(2);
    // W04 because the rule plays bank audio and one match has none.
    expect(root(fixture).querySelector('.finding.warning')?.textContent)
      .toContain(EDITOR_STRINGS.validation.w04.replace('{withoutAudio}', '3').replace('{matchCount}', '4'));
  });

  it('validates count live against matchCount', async () => {
    const {fixture, http} = await mount();
    http.expectOne((req) => pathOf(req.urlWithParams).endsWith('/bank/std-passages/item')).flush(PAGE);
    fixture.detectChanges();

    const message = root(fixture).querySelector('#rule-count-msg') as HTMLElement;
    expect(message.textContent)
      .toContain(EDITOR_STRINGS.inspector.group.countAgainst.replace('{match}', '4').replace('{total}', '6'));
    expect(message.classList.contains('is-ok')).toBe(true);

    fixture.componentRef.setInput('source', {...RULE, count: 9});
    fixture.detectChanges();

    const over = root(fixture).querySelector('#rule-count-msg') as HTMLElement;
    expect(over.textContent).toContain('Widen the filter or draw fewer');
    expect(over.classList.contains('is-error')).toBe(true);
    expect((root(fixture).querySelector('#rule-count') as HTMLInputElement).getAttribute('aria-invalid')).toBe('true');
  });

  it('suspends, and never reports valid, when the bank cannot be read', async () => {
    const {fixture, http} = await mount();
    http.expectOne((req) => pathOf(req.urlWithParams).endsWith('/bank/std-passages/item'))
      .flush({error: 'boom'}, {status: 500, statusText: 'Server Error'});
    fixture.detectChanges();

    const message = root(fixture).querySelector('#rule-count-msg') as HTMLElement;
    expect(message.textContent).toContain(EDITOR_STRINGS.validation.e04Suspended);
    expect(message.classList.contains('is-suspended')).toBe(true);
    expect(message.classList.contains('is-ok')).toBe(false);
  });

  it('emits every edit as the new source and commits through useRule', async () => {
    const {fixture, http} = await mount();
    http.expectOne((req) => pathOf(req.urlWithParams).endsWith('/bank/std-passages/item')).flush(PAGE);
    fixture.detectChanges();

    const changes: PrefillBankSource[] = [];
    const committed: PrefillBankSource[] = [];
    fixture.componentInstance.change.subscribe((source) => changes.push(source));
    fixture.componentInstance.useRule.subscribe((source) => committed.push(source));

    const prefix = root(fixture).querySelector('#rule-prefix') as HTMLInputElement;
    prefix.value = 'XX';
    prefix.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(changes[changes.length - 1]?.itemcodePrefix).toBe('XX');
    expect(changes[changes.length - 1]?.bank).toBe('std-passages');

    const count = root(fixture).querySelector('#rule-count') as HTMLInputElement;
    count.value = '3';
    count.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(changes[changes.length - 1]?.count).toBe(3);

    (root(fixture).querySelector('.actions .primary') as HTMLButtonElement).click();
    expect(committed[committed.length - 1]?.count).toBe(3);
  });

  it('offers the radiogroup for fixedBy with aria-checked', async () => {
    const {fixture, http} = await mount();
    http.expectOne((req) => pathOf(req.urlWithParams).endsWith('/bank/std-passages/item')).flush(PAGE);
    fixture.detectChanges();

    const group = root(fixture).querySelector('[role="radiogroup"]');
    expect(group).not.toBeNull();
    const radios = Array.from(group!.querySelectorAll('input[type="radio"]'));
    expect(radios.map((radio) => radio.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
  });
});
