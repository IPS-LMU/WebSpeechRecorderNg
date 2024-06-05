
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
  audioCaptureGain?:number,
  project: string,
  script: string | number | null

}
