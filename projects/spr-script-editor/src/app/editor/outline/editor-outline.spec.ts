/**
 * The outline renders two ways: a plain list below the row threshold and a CDK virtual viewport
 * above it. The second branch is a real DOM contract, not a detail — `cdk-virtual-scroll-viewport`
 * in CDK 20 throws unless a scroll strategy is present (the directive that reads `itemSize`), and
 * Angular turns a template error there into an **empty tree**: the script loads, the outline just
 * shows nothing. These specs mount the component, so only a real renderer can pass them.
 */
import {TestBed} from '@angular/core/testing';
import type {CdkDragDrop} from '@angular/cdk/drag-drop';
import {ScriptDraftService} from '../../core/script-draft.service';
import type {EditorScript} from '../../core/script.model';
import {formatSelection, type Selection} from '../selection';
import {EditorOutline} from './editor-outline';

const item = (sectionIdx: number, groupIdx: number, itemIdx: number) => ({
  itemcode: `S${sectionIdx}G${groupIdx}I${itemIdx}`,
  mediaitems: [{mimetype: 'text/plain', text: `Item ${sectionIdx}.${groupIdx}.${itemIdx}`}],
});

/** `sections * groups * items` items, plus one row per section and group and the script row. */
const scriptOf = (sections: number, groups: number, items: number): EditorScript => ({
  name: 'Large script',
  sections: Array.from({length: sections}, (_, s) => ({
    name: `Section ${s}`,
    mode: 'MANUAL',
    promptphase: 'RECORDING',
    order: 'SEQUENTIAL',
    groups: Array.from({length: groups}, (_, g) => ({
      order: 'SEQUENTIAL',
      promptItems: Array.from({length: items}, (_, i) => item(s, g, i)),
    })),
  })),
}) as unknown as EditorScript;

/**
 * The draft service the component reorders through. `model` is the loaded draft; the three edit
 * methods are spies, so a spec can assert the exact op (path and indices) the move recorded.
 * Built per mount, not in a `beforeEach` at the top of the file: Jasmine registers a top-level
 * `beforeEach` on the root suite, so it would run before every spec in the run.
 */
const draftStub = () => ({
  model: (): EditorScript | null => null,
  writesDisabled: (): boolean => false,
  move: jasmine.createSpy('move'),
  remove: jasmine.createSpy('remove'),
  insert: jasmine.createSpy('insert'),
});

let draft = draftStub();

/** The viewport measures its own box, so the host needs a definite height the way the shell gives it one. */
const mount = async (script: EditorScript) => {
  draft = draftStub();
  draft.model = () => script;
  TestBed.configureTestingModule({providers: [{provide: ScriptDraftService, useValue: draft}]});
  const fixture = TestBed.createComponent(EditorOutline);
  const host = fixture.nativeElement as HTMLElement;
  host.style.display = 'block';
  host.style.height = '600px';
  fixture.componentRef.setInput('script', script);
  fixture.detectChanges();
  // CDK renders from a measured box; give the viewport one explicitly and let it re-measure.
  const viewport = host.querySelector('cdk-virtual-scroll-viewport') as HTMLElement | null;
  if (viewport !== null) {
    viewport.style.height = '300px';
    window.dispatchEvent(new Event('resize'));
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }
  return fixture;
};

describe('EditorOutline rendering', () => {
  it('renders every row of a small script as a plain list', async () => {
    const fixture = await mount(scriptOf(1, 1, 3));
    expect((fixture.nativeElement as HTMLElement).querySelector('cdk-virtual-scroll-viewport')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.row').length).toBe(1 + 1 + 1 + 3);
  });

  it('virtualises a large script instead of rendering an empty tree', async () => {
    const fixture = await mount(scriptOf(10, 5, 80));
    const host = fixture.nativeElement as HTMLElement;
    const totalRows = 1 + 10 + 50 + 800;
    expect(host.querySelector('cdk-virtual-scroll-viewport')).not.toBeNull();
    const rendered = host.querySelectorAll('.row').length;
    expect(rendered).withContext('the virtual viewport rendered no rows').toBeGreaterThan(0);
    expect(rendered).toBeLessThan(totalRows);
  });

  it('keeps the rows of the virtual viewport selectable', async () => {
    const fixture = await mount(scriptOf(10, 5, 80));
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.row-main');
    expect(rows.length).toBeGreaterThan(0);
    rows[rows.length - 1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selection().kind).not.toBeNull();
  });
});

describe('EditorOutline reorder', () => {
  const keydown = (host: HTMLElement, key: string, altKey: boolean): void => {
    host.querySelector('.list')!.dispatchEvent(new KeyboardEvent('keydown', {key, altKey, bubbles: true}));
  };

  it('moves the selection among its siblings on Alt+ArrowUp and follows it', async () => {
    const fixture = await mount(scriptOf(1, 2, 2));
    fixture.componentRef.setInput('selection', {kind: 'item', section: 0, group: 0, item: 1});
    fixture.detectChanges();
    const emitted: Selection[] = [];
    fixture.componentInstance.select.subscribe((selection) => emitted.push(selection));

    keydown(fixture.nativeElement as HTMLElement, 'ArrowUp', true);

    expect(draft.move).toHaveBeenCalledWith('reorder', ['sections', 0, 'groups', 0, 'promptItems'], 1, 0);
    expect(emitted).toEqual([{kind: 'item', section: 0, group: 0, item: 0}]);
  });

  it('moves the selection on Alt+ArrowDown', async () => {
    const fixture = await mount(scriptOf(1, 2, 2));
    fixture.componentRef.setInput('selection', {kind: 'group', section: 0, group: 0});
    fixture.detectChanges();

    keydown(fixture.nativeElement as HTMLElement, 'ArrowDown', true);

    expect(draft.move).toHaveBeenCalledWith('reorder', ['sections', 0, 'groups'], 0, 1);
  });

  it('ignores the move at the boundary of the sibling array', async () => {
    const fixture = await mount(scriptOf(1, 2, 2));
    fixture.componentRef.setInput('selection', {kind: 'item', section: 0, group: 0, item: 1});
    fixture.detectChanges();

    keydown(fixture.nativeElement as HTMLElement, 'ArrowDown', true);

    expect(draft.move).not.toHaveBeenCalled();
  });

  it('ignores the move when the script is selected', async () => {
    const fixture = await mount(scriptOf(1, 2, 2));
    fixture.componentRef.setInput('selection', {kind: 'script'});
    fixture.detectChanges();

    keydown(fixture.nativeElement as HTMLElement, 'ArrowUp', true);

    expect(draft.move).not.toHaveBeenCalled();
  });

  it('keeps the plain ArrowUp/ArrowDown navigation and Enter selection', async () => {
    const fixture = await mount(scriptOf(1, 2, 2));
    const emitted: Selection[] = [];
    fixture.componentInstance.select.subscribe((selection) => emitted.push(selection));

    keydown(fixture.nativeElement as HTMLElement, 'ArrowDown', false);
    expect(fixture.componentInstance.focusKey()).toBe('s0');
    keydown(fixture.nativeElement as HTMLElement, 'ArrowDown', false);
    expect(fixture.componentInstance.focusKey()).toBe('s0.g0');
    keydown(fixture.nativeElement as HTMLElement, 'Enter', false);

    expect(emitted).toEqual([{kind: 'group', section: 0, group: 0}]);
  });

  it('enables the arrow buttons inside an array and disables them at its boundary', async () => {
    const fixture = await mount(scriptOf(1, 2, 2));
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.row');
    // Row order: script, section, group 0, its two items, group 1, its two items.
    const groupRow = rows[2].querySelectorAll<HTMLButtonElement>('.reorder button');
    expect(groupRow[0].disabled).toBeTrue();
    expect(groupRow[1].disabled).toBeFalse();

    groupRow[1].click();
    expect(draft.move).toHaveBeenCalledWith('reorder', ['sections', 0, 'groups'], 0, 1);

    const scriptRow = rows[0].querySelectorAll<HTMLButtonElement>('.reorder button');
    expect(scriptRow[0].disabled).toBeTrue();
    expect(scriptRow[1].disabled).toBeTrue();
  });

  it('reorders a cross-parent drop from the visible rows through remove + insert', async () => {
    const fixture = await mount(scriptOf(1, 2, 1));
    const rows = fixture.componentInstance.visible();
    const indexOf = (selection: Selection): number =>
      rows.findIndex((row) => formatSelection(row.selection) === formatSelection(selection));

    fixture.componentInstance.onDrop({
      previousIndex: indexOf({kind: 'item', section: 0, group: 0, item: 0}),
      currentIndex: indexOf({kind: 'item', section: 0, group: 1, item: 0}),
    } as unknown as CdkDragDrop<Selection>);

    expect(draft.remove).toHaveBeenCalledWith('reorder', ['sections', 0, 'groups', 0, 'promptItems'], 0);
    expect(draft.insert).toHaveBeenCalledWith(
      'reorder',
      ['sections', 0, 'groups', 1, 'promptItems'],
      0,
      jasmine.anything(),
    );
  });

  it('turns drag-drop off while filtering or virtualising, keeping the keyboard move', async () => {
    const fixture = await mount(scriptOf(1, 2, 2));
    const list = (fixture.nativeElement as HTMLElement).querySelector('.list')!;
    expect(fixture.componentInstance.dragDisabled()).toBeFalse();
    expect(list.classList).toContain('cdk-drop-list');
    expect(list.classList).not.toContain('cdk-drop-list-disabled');

    fixture.componentInstance.onFilterInput('S0G0');
    fixture.detectChanges();
    expect(fixture.componentInstance.dragDisabled()).toBeTrue();
    expect(list.classList).toContain('cdk-drop-list-disabled');

    fixture.componentRef.setInput('script', scriptOf(10, 5, 80));
    fixture.componentInstance.clearFilter();
    fixture.detectChanges();
    expect(fixture.componentInstance.virtual()).toBeTrue();
    expect(fixture.componentInstance.dragDisabled()).toBeTrue();
  });
});

describe('EditorOutline keyboard', () => {
  const keydown = (host: HTMLElement, key: string): void => {
    host.querySelector('.list')!.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true}));
  };
  const filterInput = (fixture: {nativeElement: unknown}): HTMLInputElement =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('.filter input')!;

  it('focuses the filter on / from anywhere on the route', async () => {
    const fixture = await mount(scriptOf(1, 1, 2));
    const focus = spyOn(filterInput(fixture), 'focus');

    const event = new KeyboardEvent('keydown', {key: '/', bubbles: true, cancelable: true});
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBeTrue();
    expect(focus).toHaveBeenCalled();
  });

  it('never steals / while the operator is typing in a field', async () => {
    const fixture = await mount(scriptOf(1, 1, 2));
    const focus = spyOn(filterInput(fixture), 'focus');

    const event = new KeyboardEvent('keydown', {key: '/', bubbles: true, cancelable: true});
    filterInput(fixture).dispatchEvent(event);

    expect(event.defaultPrevented).toBeFalse();
    expect(focus).not.toHaveBeenCalled();
  });

  it('leaves other keys alone', async () => {
    const fixture = await mount(scriptOf(1, 1, 2));
    const focus = spyOn(filterInput(fixture), 'focus');
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'a', bubbles: true}));
    expect(focus).not.toHaveBeenCalled();
  });

  it('collapses and expands a parent with ArrowLeft and ArrowRight', async () => {
    const fixture = await mount(scriptOf(1, 1, 3));
    const host = fixture.nativeElement as HTMLElement;
    (host.querySelectorAll('.row')[1].querySelector('.row-main') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.focusKey()).toBe('s0');
    const expanded = fixture.componentInstance.visible().length;

    keydown(host, 'ArrowLeft');
    fixture.detectChanges();
    expect(fixture.componentInstance.visible().length).toBeLessThan(expanded);
    expect(host.querySelector('.twisty[aria-expanded="false"]')).not.toBeNull();

    keydown(host, 'ArrowRight');
    fixture.detectChanges();
    expect(fixture.componentInstance.visible().length).toBe(expanded);
    expect(host.querySelector('.twisty[aria-expanded="true"]')).not.toBeNull();
  });

  it('moves into the first child on ArrowRight and out to the parent on ArrowLeft', async () => {
    const fixture = await mount(scriptOf(1, 1, 2));
    const host = fixture.nativeElement as HTMLElement;

    keydown(host, 'ArrowRight');
    expect(fixture.componentInstance.focusKey()).toBe('s0');
    keydown(host, 'ArrowRight');
    expect(fixture.componentInstance.focusKey()).toBe('s0.g0');
    keydown(host, 'ArrowRight');
    expect(fixture.componentInstance.focusKey()).toBe('s0.g0.i0');
    keydown(host, 'ArrowRight');
    expect(fixture.componentInstance.focusKey()).toBe('s0.g0.i0');

    keydown(host, 'ArrowLeft');
    expect(fixture.componentInstance.focusKey()).toBe('s0.g0');
  });

  it('expands the whole tree with a filter instead of hiding matches', async () => {
    const fixture = await mount(scriptOf(1, 1, 3));
    const host = fixture.nativeElement as HTMLElement;
    fixture.componentInstance.toggleRow(fixture.componentInstance.rows().find((row) => row.key === 's0')!);
    fixture.detectChanges();
    expect(fixture.componentInstance.visible().some((row) => row.key === 's0.g0.i2')).toBeFalse();

    fixture.componentInstance.onFilterInput('S0G0I2');
    fixture.detectChanges();
    expect(fixture.componentInstance.visible().map((row) => row.key))
      .toEqual(['script', 's0', 's0.g0', 's0.g0.i2']);
  });
});

describe('EditorOutline delete', () => {
  const keydown = (host: HTMLElement, key: string): void => {
    host.querySelector('.list')!.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true}));
  };

  it('deletes the selected node through the draft service and selects the sibling before it', async () => {
    const fixture = await mount(scriptOf(1, 2, 2));
    fixture.componentRef.setInput('selection', {kind: 'item', section: 0, group: 0, item: 1});
    fixture.detectChanges();
    const emitted: Selection[] = [];
    fixture.componentInstance.select.subscribe((selection) => emitted.push(selection));

    keydown(fixture.nativeElement as HTMLElement, 'Delete');

    expect(draft.remove).toHaveBeenCalledWith(
      jasmine.stringMatching(/^outline-delete:/), ['sections', 0, 'groups', 0, 'promptItems'], 1);
    expect(emitted).toEqual([{kind: 'item', section: 0, group: 0, item: 0}]);
  });

  it('selects the parent when the first sibling is deleted', async () => {
    const fixture = await mount(scriptOf(1, 2, 2));
    fixture.componentRef.setInput('selection', {kind: 'group', section: 0, group: 0});
    fixture.detectChanges();
    const emitted: Selection[] = [];
    fixture.componentInstance.select.subscribe((selection) => emitted.push(selection));

    keydown(fixture.nativeElement as HTMLElement, 'Delete');

    expect(draft.remove).toHaveBeenCalledWith(
      jasmine.stringMatching(/^outline-delete:/), ['sections', 0, 'groups'], 0);
    expect(emitted).toEqual([{kind: 'section', section: 0}]);
  });

  it('never deletes the script itself', async () => {
    const fixture = await mount(scriptOf(1, 1, 1));
    fixture.componentRef.setInput('selection', {kind: 'script'});
    fixture.detectChanges();

    keydown(fixture.nativeElement as HTMLElement, 'Delete');

    expect(draft.remove).not.toHaveBeenCalled();
    const scriptDelete = (fixture.nativeElement as HTMLElement)
      .querySelectorAll('.row')[0].querySelector<HTMLButtonElement>('.remove')!;
    expect(scriptDelete.disabled).toBeTrue();
  });

  it('disables delete with a reason when the draft cannot be written', async () => {
    const fixture = await mount(scriptOf(1, 1, 2));
    fixture.componentRef.setInput('selection', {kind: 'item', section: 0, group: 0, item: 0});
    draft.writesDisabled = () => true;
    fixture.detectChanges();

    const currentRow = (fixture.nativeElement as HTMLElement).querySelector('.row-main[aria-current="true"]')!.closest('.row')!;
    const remove = currentRow.querySelector<HTMLButtonElement>('.remove')!;
    expect(remove.disabled).toBeTrue();
    expect(remove.title).toContain('Read-only');

    keydown(fixture.nativeElement as HTMLElement, 'Delete');
    expect(draft.remove).not.toHaveBeenCalled();
  });

  it('routes the row button through the same delete as the key', async () => {
    const fixture = await mount(scriptOf(1, 2, 2));
    const itemRow = fixture.componentInstance.rows()
      .find((row) => row.key === 's0.g0.i1')!;
    fixture.componentInstance.deleteRow(itemRow);

    expect(draft.remove).toHaveBeenCalledWith(
      jasmine.stringMatching(/^outline-delete:/), ['sections', 0, 'groups', 0, 'promptItems'], 1);
  });
});
