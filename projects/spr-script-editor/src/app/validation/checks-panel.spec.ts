import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import type {Finding} from '../core/validation/types';
import {ChecksPanel, type FixRequest} from './checks-panel';

const DRAFT = {sections: [{groups: [{promptItems: [{itemcode: 'A1'}]}]}]};

function finding(id: string, path: string, extra: Partial<Finding> = {}): Finding {
  return {id, path, severity: 'error', message: `${id} consequence`, ...extra};
}

function setup() {
  TestBed.configureTestingModule({imports: [ChecksPanel], providers: [provideRouter([])]});
  const fixture = TestBed.createComponent(ChecksPanel);
  fixture.componentRef.setInput('draft', DRAFT);
  fixture.componentRef.setInput('lineOf', () => 3);
  fixture.componentRef.setInput('project', 'Demo1');
  fixture.componentRef.setInput('scriptId', '1245');
  return fixture;
}

describe('ChecksPanel', () => {
  it('groups the cards by severity and counts them', () => {
    const fixture = setup();
    fixture.componentRef.setInput('clientFindings', [
      finding('E01', 'sections[0].groups[0].promptItems[0].itemcode'),
      finding('W01', 'sections[0]', {severity: 'warning'}),
      finding('N03', 'name', {severity: 'note'}),
    ]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.group').length).toBe(3);
    expect(root.querySelectorAll('.count').length).toBe(3);
    expect(root.querySelector('.count[data-severity="error"]')?.textContent).toContain('1 errors');
  });

  it('renders a card as line · subject with the consequence and a deep link', () => {
    const fixture = setup();
    fixture.componentRef.setInput('clientFindings', [
      finding('E01', 'sections[0].groups[0].promptItems[0].itemcode'),
    ]);
    fixture.detectChanges();

    const card = (fixture.nativeElement as HTMLElement).querySelector('.card') as HTMLElement;
    expect(card.querySelector('.line')?.textContent).toContain('Line 3');
    expect(card.querySelector('.subject')?.textContent).toContain('Item A1 · itemcode');
    expect(card.querySelector('.consequence')?.textContent).toContain('E01 consequence');
    expect(decodeURIComponent(card.querySelector('a')?.getAttribute('href') ?? '')).toContain('sel=i:0:0:0');
  });

  it('marks a suspended finding with the unknown-count chip', () => {
    const fixture = setup();
    fixture.componentRef.setInput('clientFindings', [
      finding('E04', 'sections[0].groups[0].count', {suspended: true}),
    ]);
    fixture.detectChanges();

    const card = (fixture.nativeElement as HTMLElement).querySelector('.card') as HTMLElement;
    expect(card.getAttribute('data-suspended')).toBe('true');
    expect(card.textContent).toContain('Count unknown');
    expect(card.getAttribute('data-severity')).toBe('warning');
  });

  it('merges server findings into the same cards with a server chip', () => {
    const fixture = setup();
    fixture.componentRef.setInput('serverFindings', [finding('W11', 'sections[0]', {severity: 'warning', message: 'race'})]);
    fixture.detectChanges();

    const card = (fixture.nativeElement as HTMLElement).querySelector('.card') as HTMLElement;
    expect(card.getAttribute('data-server')).toBe('true');
    expect(card.textContent).toContain('From the server');
    expect(card.textContent).toContain('race');
  });

  it('emits the catalogue fix with its options', () => {
    const fixture = setup();
    fixture.componentRef.setInput('clientFindings', [finding('N02', 'sections[0].order', {severity: 'note', fix: 'replace-order'})]);
    fixture.detectChanges();

    const requests: FixRequest[] = [];
    fixture.componentInstance.fix.subscribe((request) => requests.push(request));

    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.actions button'));
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Use Random', 'Use Sequential']);
    (buttons[1] as HTMLButtonElement).click();

    expect(requests.length).toBe(1);
    expect(requests[0].options).toEqual({order: 'SEQUENTIAL'});
    expect(requests[0].finding.id).toBe('N02');
  });
});
