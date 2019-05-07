
export type Status= "CREATED" | "LOADED" | "STARTED_TRAINING" | "STARTED" | "COMPLETED" | "SEALED";

export interface Session{

  sessionId: string | number,
  status: Status,
  date: Date,
  loadedDate?:Date,
  startedTrainingDate?:Date,
  startedDate?:Date,
  completedDate?:Date,
  project: string,
  script: string | number

}
