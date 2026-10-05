/**
 * Runs the shared corpus (`doc/script-editor/checks/*.checks.json`) through the editor's
 * implementation (M2 V1). The server runs the same files; here they are fetched from whatever the
 * project serves them at (`doc/script-editor/checks` is mapped into the karma assets).
 *
 * A corpus file that is *not* served is a failure, not a pending spec: a renamed or dropped corpus
 * file would otherwise remove this coverage silently while the suite stayed green.
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
      expect(doc).withContext(
        `the checks corpus ${name}.checks.json is served at ${BASES.join(' or ')} — check the karma assets`)
        .not.toBeNull();
      if (doc === null) {
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
