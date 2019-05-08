
export type Status= "CREATED" | "LOADED" | "STARTED_TRAINING" | "STARTED" | "COMPLETED" | "SEALED";

export type Type= 'NORMAL' | 'TEST' | 'SINUS_TEST';

export interface Session{

  sessionId: string | number,
  status: Status,
  type: Type,
  loadedDate?:Date,
  startedTrainingDate?:Date,
  startedDate?:Date,
  completedDate?:Date,
  project: string,
  script: string | number

}
