/**
 * The outline renders two ways: a plain list below the row threshold and a CDK virtual viewport
 * above it. The second branch is a real DOM contract, not a detail — `cdk-virtual-scroll-viewport`
 * in CDK 20 throws unless a scroll strategy is present (the directive that reads `itemSize`), and
 * Angular turns a template error there into an **empty tree**: the script loads, the outline just
 * shows nothing. These specs mount the component, so only a real renderer can pass them.
 */
import {TestBed} from '@angular/core/testing';
import type {EditorScript} from '../../core/script.model';
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

/** The viewport measures its own box, so the host needs a definite height the way the shell gives it one. */
const mount = async (script: EditorScript) => {
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
