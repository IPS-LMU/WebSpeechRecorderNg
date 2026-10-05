#!/usr/bin/env node
/**
 * Static house-rule check for the editor's sources — the part of ui-spec §8 that is text, not a
 * rendered property, so the browser audits cannot see it:
 *
 *   1. every `font-size` comes from the `--spr-type-*` scale (a bare pixel value drifts from it);
 *   2. every colour is a `--spr-*` token or the fallback inside one — `var(--spr-x, #abc)` is the
 *      documented pattern, a literal standing on its own is not;
 *   3. no block element inside `<p>` (the parser hoists it out, so the tree is not the template's);
 *   4. every `(click)` sits on a real control (`button`, `a`, `input`, `select`, `textarea`,
 *      `label`, `option`, `summary`, a `mat-*`/`spre-*` component) or the host states its role.
 *
 * Usage: `node bin/editor_lint.mjs [--root <dir>]`. Exits non-zero and names `file:line` for each
 * violation; `--verbose` also prints the counts of what passed.
 */
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const ROOT = opt('root', 'projects/spr-script-editor/src');
const VERBOSE = args.includes('--verbose');

const INTERACTIVE = new Set(['button', 'a', 'input', 'select', 'textarea', 'label', 'option', 'summary']);
const COMPONENT = /^(mat-|spre-|cdk-)/;

function filesUnder(dir, match) {
  const out = [];
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...filesUnder(path, match));
    } else if (match(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

/** Line number of `index` in `text`, 1-based. */
function lineAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

const failures = [];
const passed = {type: 0, colour: 0, click: 0, structure: 0};

for (const path of filesUnder(ROOT, (name) => name.endsWith('.scss') || (name.endsWith('.ts') && !name.endsWith('.spec.ts')))) {
  const text = readFileSync(path, 'utf8');
  const where = relative(process.cwd(), path);

  // 1: type sizes.
  for (const match of text.matchAll(/font-size\s*:\s*([^;{}]+)/g)) {
    const value = match[1].trim();
    if (/^var\(--spr-type-/.test(value) || /^(inherit|unset|initial|0)$/.test(value)) {
      passed.type += 1;
      continue;
    }
    failures.push(`${where}:${lineAt(text, match.index)}: font-size "${value}" is not a --spr-type-* token`);
  }

  // 2: colours, with the var() nesting tracked so a fallback literal is allowed.
  const open = [];
  const inFallback = new Array(text.length).fill(false);
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith('var(', i)) open.push(i);
    else if (text[i] === ')' && open.length > 0) open.pop();
    if (open.length > 0 && (text[i] === '#' || text.startsWith('rgb', i))) inFallback[i] = true;
  }
  for (const match of text.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)) {
    if (inFallback[match.index]) {
      passed.colour += 1;
      continue;
    }
    failures.push(`${where}:${lineAt(text, match.index)}: colour "${match[0]}" is not a --spr-* token (a literal belongs in a var() fallback)`);
  }
}

for (const path of filesUnder(ROOT, (name) => name.endsWith('.html'))) {
  const text = readFileSync(path, 'utf8');
  const where = relative(process.cwd(), path);

  // 4: a block element inside <p>. The parser closes the paragraph before it, so the rendered tree
  // is not the template's and the layout drifts without anything failing.
  const BLOCKS = /<\/?p\b[^>]*>|<(?:div|section|article|aside|header|footer|main|nav|ul|ol|dl|table|form|h[1-6]|pre|blockquote)\b[^>]*>/g;
  let paragraphDepth = 0;
  for (const match of text.matchAll(BLOCKS)) {
    const tag = match[0];
    if (/^<\/p/.test(tag)) {
      paragraphDepth = Math.max(0, paragraphDepth - 1);
      continue;
    }
    if (/^<p\b/.test(tag)) {
      passed.structure += 1;
      if (paragraphDepth > 0) {
        failures.push(`${where}:${lineAt(text, match.index)}: <p> inside <p> — the browser closes the outer one`);
      }
      paragraphDepth += 1;
      continue;
    }
    if (paragraphDepth > 0) {
      failures.push(`${where}:${lineAt(text, match.index)}: ${tag.slice(0, tag.indexOf(' ') < 0 ? tag.length - 1 : tag.indexOf(' '))} inside <p> — the browser hoists it out of the paragraph`);
    }
  }

  // 3: click handlers on real controls.
  for (const match of text.matchAll(/\(click\)[^>]*/g)) {
    // Walk back to the tag that hosts the handler: a `<` that opens a tag and no `>` in between
    // (an Angular expression can contain a bare `<`, as in `(x?.length ?? 0) < 2`).
    let start = -1;
    for (let i = match.index - 1; i >= 0; i -= 1) {
      if (text[i] === '>') break;
      if (text[i] === '<' && /[a-zA-Z]/.test(text[i + 1] ?? '')) {
        start = i;
        break;
      }
    }
    if (start < 0) continue;
    const tag = text.slice(start, match.index + 1);
    const name = (tag.match(/^<([a-zA-Z-]+)/) ?? [])[1] ?? '?';
    const lower = name.toLowerCase();
    if (INTERACTIVE.has(lower) || COMPONENT.test(lower) || /\brole=/.test(tag)) {
      passed.click += 1;
      continue;
    }
    failures.push(`${where}:${lineAt(text, match.index)}: (click) on <${lower}> — use a control, or state its role`);
  }
}

if (VERBOSE) {
  console.log(`checked ${passed.type} font sizes, ${passed.colour} colours, ${passed.click} click handlers, ${passed.structure} paragraphs`);
}
if (failures.length > 0) {
  for (const failure of failures) console.error(`✗ ${failure}`);
  console.error(`editor lint failed: ${failures.length} violation(s)`);
  process.exit(1);
}
console.log(`Editor lint passed (${passed.type} font sizes, ${passed.colour} colours, ${passed.click} click handlers, ${passed.structure} paragraphs).`);
