/**
 * The reorder planner (ui-spec §3.1/§8): the sibling move the keyboard and the arrow buttons use,
 * the op list a drop resolves to, and the apply step that replays those ops through the draft
 * service. These are pure functions of the model, so the rules are pinned without a renderer.
 */
import type {DraftPath} from '../core/script-draft.service';
import {applyReorder, dropMove, siblingMove, type ReorderDraft, type ReorderOp} from './reorder';
import type {Selection} from './selection';

interface TestItem {
  itemcode: string;
}

interface TestGroup {
  promptItems: TestItem[];
}

interface TestSection {
  name: string;
  groups: TestGroup[];
}

interface TestScript {
  name: string;
  sections: TestSection[];
}

const testScript = (): TestScript => ({
  name: 'Demo',
  sections: [
    {
      name: 'A',
      groups: [
        {promptItems: [{itemcode: 'A0'}, {itemcode: 'A1'}]},
        {promptItems: [{itemcode: 'B0'}]},
      ],
    },
    {
      name: 'B',
      groups: [{promptItems: [{itemcode: 'C0'}]}],
    },
  ],
});

const codes = (script: TestScript): string[] => {
  const itemcodes: string[] = [];
  for (const section of script.sections) {
    for (const group of section.groups) {
      for (const item of group.promptItems) {
        itemcodes.push(item.itemcode);
      }
    }
  }
  return itemcodes;
};

function containerAt(root: unknown, path: DraftPath): unknown[] {
  let cursor: unknown = root;
  for (const key of path) {
    cursor = (cursor as Record<string | number, unknown>)[key];
  }
  return cursor as unknown[];
}

interface Recording {
  op: 'move' | 'remove' | 'insert';
  focus: string;
  path: DraftPath;
  from?: number;
  to?: number;
  index?: number;
  value?: unknown;
}

/** A `ScriptDraftService` stand-in that applies each op to the same in-place model and records it. */
class RecordingDraft implements ReorderDraft {
  readonly calls: Recording[] = [];

  constructor(readonly model: TestScript) {}

  move(focus: string, path: DraftPath, from: number, to: number): void {
    this.calls.push({op: 'move', focus, path, from, to});
    const container = containerAt(this.model, path);
    const [moved] = container.splice(from, 1);
    container.splice(to, 0, moved);
  }

  remove(focus: string, path: DraftPath, index: number): void {
    this.calls.push({op: 'remove', focus, path, index});
    containerAt(this.model, path).splice(index, 1);
  }

  insert(focus: string, path: DraftPath, index: number, value: unknown): void {
    this.calls.push({op: 'insert', focus, path, index, value});
    containerAt(this.model, path).splice(index, 0, structuredClone(value));
  }
}

const ITEMS_0_0: DraftPath = ['sections', 0, 'groups', 0, 'promptItems'];
const ITEMS_0_1: DraftPath = ['sections', 0, 'groups', 1, 'promptItems'];
const GROUPS_0: DraftPath = ['sections', 0, 'groups'];
const GROUPS_1: DraftPath = ['sections', 1, 'groups'];

describe('siblingMove', () => {
  it('moves an item up inside its group', () => {
    expect(siblingMove(testScript(), {kind: 'item', section: 0, group: 0, item: 1}, -1)).toEqual({
      path: ITEMS_0_0,
      from: 1,
      to: 0,
    });
  });

  it('moves an item down inside its group', () => {
    expect(siblingMove(testScript(), {kind: 'item', section: 0, group: 0, item: 0}, 1)).toEqual({
      path: ITEMS_0_0,
      from: 0,
      to: 1,
    });
  });

  it('moves a group among its section siblings', () => {
    expect(siblingMove(testScript(), {kind: 'group', section: 0, group: 1}, -1)).toEqual({
      path: GROUPS_0,
      from: 1,
      to: 0,
    });
  });

  it('moves a section among the sections', () => {
    expect(siblingMove(testScript(), {kind: 'section', section: 1}, -1)).toEqual({
      path: ['sections'],
      from: 1,
      to: 0,
    });
  });

  it('refuses the first sibling moving up', () => {
    expect(siblingMove(testScript(), {kind: 'section', section: 0}, -1)).toBeNull();
    expect(siblingMove(testScript(), {kind: 'group', section: 0, group: 0}, -1)).toBeNull();
    expect(siblingMove(testScript(), {kind: 'item', section: 0, group: 0, item: 0}, -1)).toBeNull();
  });

  it('refuses the last sibling moving down', () => {
    expect(siblingMove(testScript(), {kind: 'section', section: 1}, 1)).toBeNull();
    expect(siblingMove(testScript(), {kind: 'group', section: 0, group: 1}, 1)).toBeNull();
    expect(siblingMove(testScript(), {kind: 'item', section: 0, group: 0, item: 1}, 1)).toBeNull();
  });

  it('refuses the script, which has no siblings', () => {
    expect(siblingMove(testScript(), {kind: 'script'}, -1)).toBeNull();
    expect(siblingMove(testScript(), {kind: 'script'}, 1)).toBeNull();
  });

  it('refuses an index that is no longer in the model', () => {
    expect(siblingMove(testScript(), {kind: 'section', section: 7}, -1)).toBeNull();
  });
});

describe('dropMove', () => {
  it('resolves a drop inside one array to a single move', () => {
    expect(dropMove(testScript(), {kind: 'item', section: 0, group: 0, item: 0}, {kind: 'item', section: 0, group: 0, item: 1}))
      .toEqual({ops: [{kind: 'move', path: ITEMS_0_0, from: 0, to: 1}]});
    expect(dropMove(testScript(), {kind: 'group', section: 0, group: 0}, {kind: 'group', section: 0, group: 1}))
      .toEqual({ops: [{kind: 'move', path: GROUPS_0, from: 0, to: 1}]});
    expect(dropMove(testScript(), {kind: 'section', section: 1}, {kind: 'section', section: 0}))
      .toEqual({ops: [{kind: 'move', path: ['sections'], from: 1, to: 0}]});
  });

  it('resolves a drop onto itself to nothing', () => {
    expect(dropMove(testScript(), {kind: 'item', section: 0, group: 0, item: 0}, {kind: 'item', section: 0, group: 0, item: 0}))
      .toBeNull();
  });

  it('resolves a cross-parent item drop to remove + insert', () => {
    expect(dropMove(testScript(), {kind: 'item', section: 0, group: 0, item: 1}, {kind: 'item', section: 0, group: 1, item: 0}))
      .toEqual({
        ops: [
          {kind: 'remove', path: ITEMS_0_0, index: 1},
          {kind: 'insert', path: ITEMS_0_1, index: 0},
        ],
      });
  });

  it('resolves a cross-section group drop to remove + insert', () => {
    expect(dropMove(testScript(), {kind: 'group', section: 0, group: 1}, {kind: 'group', section: 1, group: 0}))
      .toEqual({
        ops: [
          {kind: 'remove', path: GROUPS_0, index: 1},
          {kind: 'insert', path: GROUPS_1, index: 0},
        ],
      });
  });

  it('refuses a cross-kind drop', () => {
    expect(dropMove(testScript(), {kind: 'section', section: 0}, {kind: 'group', section: 0, group: 0})).toBeNull();
    expect(dropMove(testScript(), {kind: 'group', section: 0, group: 0}, {kind: 'item', section: 0, group: 0, item: 0}))
      .toBeNull();
    expect(dropMove(testScript(), {kind: 'item', section: 0, group: 0, item: 0}, {kind: 'section', section: 1})).toBeNull();
  });

  it('refuses the script as dragged or as target', () => {
    expect(dropMove(testScript(), {kind: 'script'}, {kind: 'section', section: 0})).toBeNull();
    expect(dropMove(testScript(), {kind: 'section', section: 0}, {kind: 'script'})).toBeNull();
  });

  it('refuses a target index outside the model', () => {
    expect(dropMove(testScript(), {kind: 'item', section: 0, group: 0, item: 0}, {kind: 'item', section: 0, group: 0, item: 9}))
      .toBeNull();
  });
});

describe('applyReorder', () => {
  it('applies a same-array move exactly like an in-place splice', () => {
    const base = testScript();
    const expected = testScript();
    const items = expected.sections[0].groups[0].promptItems;
    const [moved] = items.splice(1, 1);
    items.splice(0, 0, moved);

    const draft = new RecordingDraft(base);
    const ops: ReorderOp[] = [{kind: 'move', path: ITEMS_0_0, from: 1, to: 0}];
    applyReorder(draft, ops, base);

    expect(codes(base)).toEqual(codes(expected));
    expect(draft.calls).toEqual([{op: 'move', focus: 'reorder', path: ITEMS_0_0, from: 1, to: 0}]);
  });

  it('carries the item value of a cross-parent drop from the current model', () => {
    const base = testScript();
    const draft = new RecordingDraft(base);
    const drop = dropMove(base, {kind: 'item', section: 0, group: 0, item: 1}, {kind: 'item', section: 0, group: 1, item: 0});
    expect(drop).not.toBeNull();

    applyReorder(draft, drop!.ops, base);

    expect(codes(base)).toEqual(['A0', 'A1', 'B0', 'C0']);
    expect(draft.calls.map((call) => call.op)).toEqual(['remove', 'insert']);
    expect(draft.calls[1].value).toEqual({itemcode: 'A1'});
    expect(draft.calls.every((call) => call.focus === 'reorder')).toBeTrue();
  });

  it('leaves every other element in place on a cross-parent drop', () => {
    const base = testScript();
    const draft = new RecordingDraft(base);
    const drop = dropMove(base, {kind: 'item', section: 0, group: 0, item: 0}, {kind: 'item', section: 0, group: 1, item: 0})!;

    applyReorder(draft, drop.ops, base);

    expect(base.sections[0].groups[0].promptItems.map((item) => item.itemcode)).toEqual(['A1']);
    expect(base.sections[0].groups[1].promptItems.map((item) => item.itemcode)).toEqual(['A0', 'B0']);
  });
});
