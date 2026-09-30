
import {PrefillChoices} from "../script/prefill";

export type Status= "CREATED" | "LOADED" | "STARTED_TRAINING" | "STARTED" | "COMPLETED";

export type Type= 'NORM' | 'TEST' | 'TEST_DEF_A' | 'SINUS_TEST';

export interface Session{

  sessionId: string | number,
  status: Status,
  sealed?:boolean,
  type: Type,
  loadedDate?:Date,
  startedTrainingDate?:Date,
  startedDate?:Date,
  completedDate?:Date,
  restartedDate?:Date,
  project: string,
  script: string | number,
  /**
   * Which external list fills which placeholder prompt item (keyed by the placeholder's item
   * code). Written when the script is loaded and reused on every later reload, so the drawn
   * lists can be traced back in the session record and the generated item codes stay stable
   * across reloads.
   */
  prefills?: PrefillChoices

}
