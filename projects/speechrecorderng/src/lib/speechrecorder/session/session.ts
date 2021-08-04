
export type Status= "CREATED" | "LOADED" | "STARTED_TRAINING" | "STARTED" | "COMPLETED";

export type Type= 'NORM' | 'TEST' | 'TEST_DEF_A' | 'SINUS_TEST';

export interface Session extends GlobSession{
  sessionId: string | number,
}

export interface GlobSession{
  uuid: string,
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
  speakers?: Array<number|string>,
}
