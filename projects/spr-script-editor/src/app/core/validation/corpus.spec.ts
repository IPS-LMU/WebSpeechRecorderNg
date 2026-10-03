/**
 * Runs the shared corpus (`doc/script-editor/checks/*.checks.json`) through the editor's
 * implementation (M2 V1). The server runs the same files; here they are fetched from whatever the
 * project serves the fixtures at, so the spec is a no-op (pending) when the build does not serve
 * them. `npm run`'s editor job is expected to expose `doc/script-editor/checks` under
 * `/test/checks` or `/checks`.
 */
import {CORPUS_FILES, type CorpusDoc, runCorpus} from './corpus';

const BASES = ['/test/checks', '/checks', '/assets/checks'];
const CLEAN = 'clean';

async function loadCorpus(name: string): Promise<CorpusDoc | null> {
  for (const base of BASES) {
    try {
      const response = await fetch(`${base}/${name}.checks.json`);
      if (response.ok) {
        return (await response.json()) as CorpusDoc;
      }
    } catch {
      // Try the next location.
    }
  }
  return null;
}

describe('shared check corpus', () => {
  for (const name of CORPUS_FILES) {
    it(`${name}.checks.json matches the editor implementation`, async () => {
      const doc = await loadCorpus(name);
      if (doc === null) {
        pending(`corpus not served at ${BASES.join(' or ')}`);
        return;
      }
      const {findings, diff} = runCorpus(doc);
      expect(diff.missing).withContext('missing expected findings').toEqual([]);
      expect(diff.unexpectedErrors).withContext('unexpected error findings').toEqual([]);
      if (name === CLEAN) {
        expect(findings).withContext('clean script must have no findings').toEqual([]);
      }
    });
  }
});
