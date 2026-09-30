import {Injectable} from "@angular/core";
import {Observable, forkJoin, map, of} from "rxjs";
import {Script} from "./script";
import {ScriptService} from "./script.service";
import {PrefillChoice, PrefillChoices, PrefillSource, ScriptPrefillUtil} from "./prefill";
import {Session} from "../session/session";
import {SprLogger} from "../../utils/logger";

/** The script with every prefill resolved, and which list was drawn per placeholder item. */
export interface ResolvedScript {
  script: Script;
  choices: PrefillChoices;
}

/**
 * Resolves the prefill declarations of a script when it is loaded: fetches each source from
 * the script bank, draws the lists and expands the placeholder items.
 *
 * A draw is either the choice already stored on the session (so a reload reproduces the same
 * prompt items and matches already recorded files) or a fresh random pick. The resulting
 * choices are handed back to the caller, which persists them on the session.
 */
@Injectable()
export class ScriptPrefillService {

  constructor(private scriptService: ScriptService) {}

  resolve(script: Script, session: Session | null | undefined): Observable<ResolvedScript> {
    const specs = ScriptPrefillUtil.specs(script);
    if (specs.length === 0) {
      return of({script, choices: {}});
    }
    const sourceIds = Array.from(new Set(specs.map((spec) => spec.spec.source)));
    const sources = sourceIds.map((sourceId) =>
      this.scriptService.scriptResourceObservable<PrefillSource>(sourceId)
        .pipe(map((source) => [sourceId, source] as const))
    );
    return forkJoin(sources).pipe(map((fetched) => {
      const sourceMap = new Map<string, PrefillSource>(fetched.map(([id, source]) => [id, source]));
      const stored = session?.prefills ?? {};
      const choices: PrefillChoices = {};
      for (const {itemcode, spec} of specs) {
        choices[itemcode] = ScriptPrefillService.draw(spec.source, sourceMap.get(spec.source), stored[itemcode], itemcode);
      }
      return {script: ScriptPrefillUtil.expand(script, sourceMap, choices), choices};
    }));
  }

  /** The stored choice when it is usable; a fresh random draw otherwise. */
  private static draw(sourceId: string, source: PrefillSource | undefined, stored: PrefillChoice | null | undefined, itemcode: string): PrefillChoice {
    const reusable = ScriptPrefillUtil.choiceFor(sourceId, stored);
    if (reusable != null) {
      const list = ScriptPrefillUtil.drawList(source ?? {lists: []}, reusable);
      if (list != null) {
        return reusable;
      }
      SprLogger.warn(`Session holds prefill choice '${stored?.list}' for item ${itemcode}, but source '${sourceId}' has no such list; drawing a fresh one.`);
    }
    if (source == null) {
      throw new Error(`prefill of item ${itemcode}: source '${sourceId}' could not be fetched`);
    }
    const list = ScriptPrefillUtil.drawList(source, null);
    if (list == null) {
      throw new Error(`prefill of item ${itemcode}: source '${sourceId}' holds no lists`);
    }
    return {source: sourceId, list: list.id};
  }
}
