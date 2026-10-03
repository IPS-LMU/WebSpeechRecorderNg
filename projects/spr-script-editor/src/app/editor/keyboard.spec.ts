import {isTypingTarget} from './keyboard';

/**
 * The `/` shortcut (ui-spec §8) must not fire while the operator is typing, so the guard has to
 * recognise every field kind the editor renders. Pure function, pure test.
 */
describe('isTypingTarget', () => {
  it('is false for the document and non-element targets', () => {
    expect(isTypingTarget(document)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it('is true for the text-entry fields, including selects', () => {
    for (const tag of ['input', 'textarea', 'select']) {
      expect(isTypingTarget(document.createElement(tag))).withContext(tag).toBe(true);
    }
  });

  it('is true for a contenteditable element', () => {
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    expect(isTypingTarget(editable)).toBe(true);
  });

  it('is false for ordinary elements and buttons', () => {
    expect(isTypingTarget(document.createElement('div'))).toBe(false);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
  });
});
