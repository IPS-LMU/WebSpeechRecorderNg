
export type Status= "CREATED" | "LOADED" | "STARTED_TRAINING" | "STARTED" | "COMPLETED";

export type Type= 'NORM' | 'TEST' | 'SINUS_TEST';

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
  script: string | number

}
